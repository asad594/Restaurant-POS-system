from django.contrib import admin
from .models import Table, Order, OrderItem

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1

@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ('id', 'number', 'status')
    list_filter = ('status',)
    search_fields = ('number',)

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'table', 'status', 'total_amount', 'created_at')
    list_filter = ('status', 'table', 'created_at')
    search_fields = ('id', 'table__number')
    inlines = [OrderItemInline]

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'menu_item', 'quantity', 'subtotal')
    list_filter = ('menu_item', 'order')
    search_fields = ('order__id', 'menu_item__name')
