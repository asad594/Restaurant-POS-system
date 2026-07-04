from django.db import models
from menu.models import MenuItem
from django.utils import timezone

class Table(models.Model):
    STATUS_CHOICES = [
        ('free', 'Free'),
        ('occupied', 'Occupied'),
    ]
    number = models.IntegerField(unique=True)
    capacity = models.IntegerField(default=4)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='free')
    occupied_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.status == 'occupied' and not self.occupied_at:
            self.occupied_at = timezone.now()
        elif self.status == 'free':
            self.occupied_at = None
            
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            update_fields = set(update_fields)
            update_fields.add('occupied_at')
            kwargs['update_fields'] = list(update_fields)
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Table {self.number} ({self.status.capitalize()})"

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('preparing', 'Preparing'),
        ('ready', 'Ready'),
        ('served', 'Served'),
    ]
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    @property
    def table_number(self):
        return self.table.number if self.table else "Takeaway"

    def __str__(self):
        table_info = f"Table {self.table.number}" if self.table else "Takeaway"
        return f"Order #{self.id} - {table_info} ({self.status.capitalize()})"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    def save(self, *args, **kwargs):
        # Auto-compute subtotal
        if self.menu_item:
            self.subtotal = self.menu_item.price * self.quantity
        super().save(*args, **kwargs)
        # Recalculate order total
        self.update_order_total()

    def delete(self, *args, **kwargs):
        order = self.order
        super().delete(*args, **kwargs)
        # Recalculate order total after deletion
        total = sum(item.subtotal for item in order.items.all())
        order.total_amount = total
        order.save(update_fields=['total_amount'])

    def update_order_total(self):
        order = self.order
        total = sum(item.subtotal for item in order.items.all())
        order.total_amount = total
        order.save(update_fields=['total_amount'])

    def __str__(self):
        return f"{self.quantity}x {self.menu_item.name} for Order #{self.order.id}"
