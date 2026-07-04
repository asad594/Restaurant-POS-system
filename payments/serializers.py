from rest_framework import serializers
from .models import Payment
from orders.serializers import OrderSerializer

class PaymentSerializer(serializers.ModelSerializer):
    order_detail = OrderSerializer(source='order', read_only=True)
    change_returned = serializers.ReadOnlyField()
    cashier_name = serializers.CharField(source='cashier.username', read_only=True, default='')

    class Meta:
        model = Payment
        fields = ['id', 'order', 'order_detail', 'method', 'amount_paid', 'change_returned', 'timestamp', 'cashier_name']
