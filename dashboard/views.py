from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, Min
from django.utils import timezone
from datetime import timedelta
from django.views.generic import TemplateView, DetailView
from orders.models import Order, OrderItem
from menu.models import MenuItem
from django.shortcuts import render, get_object_or_404
import decimal

# Custom User Management Imports
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAdminUser
from .models import DailyRevenue
from payments.models import Payment


def get_next_close_day():
    # Keep historical orders and payments in database for records/ledger
    # closed_dates = list(DailyRevenue.objects.values_list('date', flat=True))
    # if closed_dates:
    #     for closed_date in closed_dates:
    #         start_of_day = timezone.make_aware(timezone.datetime(closed_date.year, closed_date.month, closed_date.day, 3, 0, 0))
    #         end_of_day = timezone.make_aware(timezone.datetime(closed_date.year, closed_date.month, closed_date.day, 2, 59, 59)) + timedelta(days=1)
    #         Order.objects.filter(created_at__range=(start_of_day, end_of_day)).delete()

    now_local = timezone.localtime(timezone.now())
    if now_local.hour < 3:
        today = now_local.date() - timedelta(days=1)
    else:
        today = now_local.date()

    earliest_order = Order.objects.order_by('created_at').first()
    earliest_payment = Payment.objects.order_by('timestamp').first()

    earliest_ts = None
    if earliest_order and earliest_payment:
        earliest_ts = min(earliest_order.created_at, earliest_payment.timestamp)
    elif earliest_order:
        earliest_ts = earliest_order.created_at
    elif earliest_payment:
        earliest_ts = earliest_payment.timestamp

    if earliest_ts is None:
        return today

    earliest_local = timezone.localtime(earliest_ts)
    if earliest_local.hour < 3:
        start_date = earliest_local.date() - timedelta(days=1)
    else:
        start_date = earliest_local.date()

    closed_dates = set(DailyRevenue.objects.values_list('date', flat=True))

    date_var = start_date
    while date_var < today:
        if date_var not in closed_dates:
            start_of_day = timezone.make_aware(timezone.datetime(date_var.year, date_var.month, date_var.day, 3, 0, 0))
            end_of_day = timezone.make_aware(timezone.datetime(date_var.year, date_var.month, date_var.day, 2, 59, 59)) + timedelta(days=1)
            
            has_orders = Order.objects.filter(created_at__range=(start_of_day, end_of_day)).exists()
            has_payments = Payment.objects.filter(timestamp__range=(start_of_day, end_of_day)).exists()
            
            if has_orders or has_payments:
                return date_var
        date_var += timedelta(days=1)

    return today


class DashboardStatsAPIView(APIView):
    def get(self, request):
        now_local = timezone.localtime(timezone.now())
        if now_local.hour < 3:
            today = now_local.date() - timedelta(days=1)
        else:
            today = now_local.date()
        start_of_today = timezone.make_aware(timezone.datetime(today.year, today.month, today.day, 3, 0, 0))
        end_of_today = timezone.make_aware(timezone.datetime(today.year, today.month, today.day, 2, 59, 59)) + timedelta(days=1)
        
        # Today's total sales (orders created today)
        today_orders = Order.objects.filter(created_at__range=(start_of_today, end_of_today))
        total_orders_count = today_orders.count()
        
        subtotal_sum = today_orders.aggregate(total=Sum('total_amount'))['total'] or decimal.Decimal('0.00')
        tax_rate = decimal.Decimal('0.05')
        today_total_revenue = subtotal_sum * (decimal.Decimal('1.00') + tax_rate)
        today_total_revenue = float(today_total_revenue)
        
        # Top 5 selling items
        top_items_qs = OrderItem.objects.values('menu_item__name', 'menu_item__price') \
            .annotate(total_quantity=Sum('quantity'), total_revenue=Sum('subtotal')) \
            .order_by('-total_quantity')[:5]
            
        top_selling_items = []
        for item in top_items_qs:
            top_selling_items.append({
                'name': item['menu_item__name'],
                'price': float(item['menu_item__price']),
                'quantity': item['total_quantity'],
                'revenue': float(item['total_revenue'])
            })
            
        # Daily revenue graph data for the last 7 days
        daily_revenue = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_start = timezone.make_aware(timezone.datetime(day.year, day.month, day.day, 3, 0, 0))
            day_end = timezone.make_aware(timezone.datetime(day.year, day.month, day.day, 2, 59, 59)) + timedelta(days=1)
            
            day_orders = Order.objects.filter(created_at__range=(day_start, day_end))
            day_subtotal = day_orders.aggregate(total=Sum('total_amount'))['total'] or decimal.Decimal('0.00')
            day_revenue = day_subtotal * (decimal.Decimal('1.00') + tax_rate)
            
            daily_revenue.append({
                'date': day.strftime('%a, %b %d'),
                'revenue': float(day_revenue)
            })
            
        next_close_day = get_next_close_day()
        next_close_day_formatted = next_close_day.strftime('%A, %B %d %Y')
        next_close_day_is_today = (next_close_day == today)
            
        return Response({
            'today_revenue': today_total_revenue,
            'today_orders_count': total_orders_count,
            'top_selling_items': top_selling_items,
            'daily_revenue': daily_revenue,
            'next_close_day': next_close_day.strftime('%Y-%m-%d'),
            'next_close_day_formatted': next_close_day_formatted,
            'next_close_day_is_today': next_close_day_is_today
        })

# Frontend views
class POSIndexView(LoginRequiredMixin, TemplateView):
    login_url = '/admin-panel/login/'
    template_name = 'pos/index.html'

class KitchenDisplayView(LoginRequiredMixin, TemplateView):
    login_url = '/admin-panel/login/'
    template_name = 'pos/kitchen.html'

class BillReceiptView(LoginRequiredMixin, DetailView):
    login_url = '/admin-panel/login/'
    model = Order
    template_name = 'pos/bill.html'
    context_object_name = 'order'
    pk_url_kwarg = 'order_id'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        order = self.object
        tax_rate = decimal.Decimal('0.05')
        context['tax'] = order.total_amount * tax_rate
        context['grand_total'] = order.total_amount * (decimal.Decimal('1.00') + tax_rate)
        payment = order.payments.first()
        context['payment'] = payment
        return context

class DashboardIndexView(LoginRequiredMixin, TemplateView):
    login_url = '/admin-panel/login/'
    template_name = 'dashboard/index.html'


# Custom User Administration viewsets
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'is_staff', 'is_superuser')
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        password = validated_data.pop('password')
        is_superuser = validated_data.get('is_superuser', False)
        is_staff = validated_data.get('is_staff', True)
        
        if is_superuser:
            user = User.objects.create_superuser(
                username=validated_data['username'],
                email=validated_data.get('email', ''),
                password=password
            )
        else:
            user = User.objects.create_user(
                username=validated_data['username'],
                email=validated_data.get('email', ''),
                password=password,
                is_staff=is_staff
            )
        return user

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]


class EndOfDayAPIView(APIView):
    def post(self, request):
        today = get_next_close_day()
        start_of_today = timezone.make_aware(timezone.datetime(today.year, today.month, today.day, 3, 0, 0))
        end_of_today = timezone.make_aware(timezone.datetime(today.year, today.month, today.day, 2, 59, 59)) + timedelta(days=1)
        
        # Today's total orders count from Order model
        today_orders = Order.objects.filter(created_at__range=(start_of_today, end_of_today))
        total_orders = today_orders.count()
        
        # Today's payments from Payment model
        today_payments = Payment.objects.filter(timestamp__range=(start_of_today, end_of_today))
        
        cash_revenue = decimal.Decimal('0.00')
        card_revenue = decimal.Decimal('0.00')
        
        for p in today_payments:
            net_amount = p.amount_paid - p.change_returned
            if p.method == 'cash':
                cash_revenue += net_amount
            elif p.method == 'card':
                card_revenue += net_amount
                
        total_revenue = cash_revenue + card_revenue
        
        # Save or update DailyRevenue record
        daily_rev, created = DailyRevenue.objects.update_or_create(
            date=today,
            defaults={
                'total_orders': total_orders,
                'total_revenue': total_revenue,
                'cash_revenue': cash_revenue,
                'card_revenue': card_revenue
            }
        )
        
        # Keep historical orders and payments in database for records/ledger
        # today_orders.delete()
        
        return Response({
            'id': daily_rev.id,
            'date': daily_rev.date.strftime('%Y-%m-%d'),
            'total_orders': daily_rev.total_orders,
            'total_revenue': float(daily_rev.total_revenue),
            'cash_revenue': float(daily_rev.cash_revenue),
            'card_revenue': float(daily_rev.card_revenue),
            'created_at': daily_rev.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

class DailyRevenueAPIView(APIView):
    def get(self, request):
        records = DailyRevenue.objects.all().order_by('-date')
        data = []
        for r in records:
            data.append({
                'id': r.id,
                'date': r.date.strftime('%Y-%m-%d'),
                'total_orders': r.total_orders,
                'total_revenue': float(r.total_revenue),
                'cash_revenue': float(r.cash_revenue),
                'card_revenue': float(r.card_revenue),
                'created_at': r.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        return Response(data)


