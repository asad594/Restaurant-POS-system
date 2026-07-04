from django.db import models

class DailyRevenue(models.Model):
    date = models.DateField(unique=True)
    total_orders = models.IntegerField()
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    cash_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    card_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Daily Revenues"
        ordering = ['-date']

    def __str__(self):
        return f"{self.date} - Total: {self.total_revenue}"
