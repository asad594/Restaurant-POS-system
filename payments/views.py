from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import Payment
from orders.models import Order
from .serializers import PaymentSerializer

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-timestamp')
    serializer_class = PaymentSerializer

    def create(self, request, *args, **kwargs):
        order_id = request.data.get('order')
        order = get_object_or_404(Order, id=order_id)
        
        if order.status == 'served' and Payment.objects.filter(order=order).exists():
            return Response(
                {"error": "This order has already been paid and served."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        cashier = self.request.user if self.request.user.is_authenticated else None
        if not cashier:
            from django.contrib.auth.models import User
            cashier = User.objects.first()
        serializer.save(cashier=cashier)

    @action(detail=False, methods=['post'], url_path='process')
    def process_payment(self, request):
        return self.create(request)

