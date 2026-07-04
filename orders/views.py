from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import Table, Order, OrderItem
from menu.models import MenuItem
from .serializers import TableSerializer, OrderSerializer, OrderItemSerializer

class TableViewSet(viewsets.ModelViewSet):
    serializer_class = TableSerializer

    def get_queryset(self):
        # Auto-free tables that have been occupied for more than 1 hour
        from django.utils import timezone
        from datetime import timedelta
        
        expired_time = timezone.now() - timedelta(hours=1)
        expired_tables = Table.objects.filter(status='occupied', occupied_at__lt=expired_time)
        if expired_tables.exists():
            expired_tables.update(status='free', occupied_at=None)
            
        return Table.objects.all().order_by('number')

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer

    def get_queryset(self):
        queryset = Order.objects.all().order_by('-created_at')
        
        # Exclude orders from closed days
        from dashboard.models import DailyRevenue
        from django.db.models import Q
        from django.utils import timezone
        from datetime import timedelta
        import datetime
        
        closed_dates = list(DailyRevenue.objects.values_list('date', flat=True))
        if closed_dates:
            exclude_query = Q()
            for closed_date in closed_dates:
                start_of_day = timezone.make_aware(
                    datetime.datetime(closed_date.year, closed_date.month, closed_date.day, 3, 0, 0)
                )
                end_of_day = timezone.make_aware(
                    datetime.datetime(closed_date.year, closed_date.month, closed_date.day, 2, 59, 59, 999999)
                ) + timedelta(days=1)
                
                exclude_query |= Q(created_at__range=(start_of_day, end_of_day))
            
            queryset = queryset.exclude(exclude_query)
            
        return queryset

    # Custom action for creating orders: POST /api/orders/create/
    @action(detail=False, methods=['post'], url_path='create')
    def create_order(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    # Custom action for kitchen display: GET /api/orders/kitchen/
    @action(detail=False, methods=['get'], url_path='kitchen')
    def kitchen_orders(self, request):
        queryset = Order.objects.filter(status__in=['pending', 'preparing', 'ready']).order_by('created_at')
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    # Custom action for updating status: PUT /api/orders/{id}/update-status/
    @action(detail=True, methods=['put'], url_path='update-status')
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Order.STATUS_CHOICES):
            return Response({'error': f'Invalid status value: {new_status}'}, status=status.HTTP_400_BAD_REQUEST)
            
        order.status = new_status
        order.save(update_fields=['status'])
        
        if new_status == 'served':
            # Note: Table remains occupied for 1 hour from order creation, so we do not free it here.
            pass
            
            # Automatically create a cash payment record if none exists for this served order
            from payments.models import Payment
            import decimal
            if not Payment.objects.filter(order=order).exists():
                tax_rate = decimal.Decimal('0.05')
                grand_total = order.total_amount * (decimal.Decimal('1.00') + tax_rate)
                grand_total = grand_total.quantize(decimal.Decimal('0.01'), rounding=decimal.ROUND_HALF_UP)
                
                cashier = request.user if request.user.is_authenticated else None
                if not cashier:
                    from django.contrib.auth.models import User
                    cashier = User.objects.first()
                
                Payment.objects.create(
                    order=order,
                    method='cash',
                    amount_paid=grand_total,
                    change_returned=decimal.Decimal('0.00'),
                    cashier=cashier
                )
            
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # Custom action for adding items: POST /api/orders/{id}/add-item/
    @action(detail=True, methods=['post'], url_path='add-item')
    def add_item(self, request, pk=None):
        order = self.get_object()
        menu_item_id = request.data.get('menu_item')
        quantity = int(request.data.get('quantity', 1))
        
        menu_item = get_object_or_404(MenuItem, id=menu_item_id)
        
        order_item, created = OrderItem.objects.get_or_create(
            order=order,
            menu_item=menu_item,
            defaults={'quantity': quantity}
        )
        
        if not created:
            order_item.quantity += quantity
            order_item.save()
            
        order.refresh_from_db()
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # Custom action for removing items: DELETE /api/orders/{id}/remove-item/{item_id}/
    @action(detail=True, methods=['delete'], url_path='remove-item/(?P<item_id>[^/.]+)')
    def remove_item(self, request, pk=None, item_id=None):
        order = self.get_object()
        
        try:
            order_item = OrderItem.objects.get(id=item_id, order=order)
        except OrderItem.DoesNotExist:
            order_item = get_object_or_404(OrderItem, order=order, menu_item_id=item_id)
            
        order_item.delete()
        
        order.refresh_from_db()
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)

