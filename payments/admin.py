from django.contrib import admin
from .models import Payment

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'method', 'amount_paid', 'change_returned', 'timestamp')
    list_filter = ('method', 'timestamp')
    search_fields = ('order__id',)
