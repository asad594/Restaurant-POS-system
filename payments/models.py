from django.db import models
from orders.models import Order
import decimal

class Payment(models.Model):
    METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('card', 'Card'),
    ]
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    cashier = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    method = models.CharField(max_length=10, choices=METHOD_CHOICES)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    change_returned = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    timestamp = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # Calculate change if cash payment (with 5% GST)
        order_total = self.order.total_amount
        tax_rate = decimal.Decimal('0.05')
        grand_total = order_total * (decimal.Decimal('1.00') + tax_rate)
        
        # Round grand total to 2 decimal places
        grand_total = grand_total.quantize(decimal.Decimal('0.01'), rounding=decimal.ROUND_HALF_UP)
        
        if self.method == 'cash':
            self.change_returned = max(decimal.Decimal('0.00'), self.amount_paid - grand_total)
        else:
            self.amount_paid = grand_total
            self.change_returned = decimal.Decimal('0.00')
            
        super().save(*args, **kwargs)
        
        # When payment is processed:
        # 1. Update order status to served
        self.order.status = 'served'
        self.order.save(update_fields=['status'])
        
        # 2. Note: Table remains occupied for 1 hour from order creation, so we do not free it here.

    def __str__(self):
        return f"Payment #{self.id} for Order #{self.order.id} ({self.method.capitalize()})"
