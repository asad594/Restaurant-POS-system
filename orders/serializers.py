from rest_framework import serializers
from .models import Table, Order, OrderItem
from menu.models import MenuItem
from menu.serializers import MenuItemSerializer

class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = ['id', 'number', 'status', 'capacity']

class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_detail = MenuItemSerializer(source='menu_item', read_only=True)
    menu_item = serializers.PrimaryKeyRelatedField(queryset=MenuItem.objects.all())

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'menu_item_detail', 'quantity', 'subtotal']
        read_only_fields = ['subtotal']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    table_number = serializers.ReadOnlyField()

    class Meta:
        model = Order
        fields = ['id', 'table', 'table_number', 'created_at', 'status', 'total_amount', 'items']
        read_only_fields = ['total_amount', 'created_at']

    def validate_table(self, value):
        if value and value.status == 'occupied':
            from django.utils import timezone
            from datetime import timedelta
            if value.occupied_at and timezone.now() > value.occupied_at + timedelta(hours=1):
                value.status = 'free'
                value.occupied_at = None
                value.save(update_fields=['status', 'occupied_at'])
            else:
                raise serializers.ValidationError("This table is already occupied.")
        return value

    def create(self, validated_data):
        # Retrieve raw items from initial_data since read_only items won't be in validated_data
        items_data = self.initial_data.get('items', [])
        table = validated_data.get('table')
        
        # Change table status to occupied
        if table:
            table.status = 'occupied'
            table.save(update_fields=['status'])

        order = Order.objects.create(**validated_data)
        
        for item_data in items_data:
            menu_item_id = item_data.get('menu_item')
            quantity = int(item_data.get('quantity', 1))
            menu_item = MenuItem.objects.get(id=menu_item_id)
            OrderItem.objects.create(order=order, menu_item=menu_item, quantity=quantity)
            
        # Update order total
        order.total_amount = sum(item.subtotal for item in order.items.all())
        order.save(update_fields=['total_amount'])
        
        return order
