from django.urls import path
from .views import POSIndexView, KitchenDisplayView, BillReceiptView, DashboardIndexView

urlpatterns = [
    path('', POSIndexView.as_view(), name='pos-index'),
    path('kitchen/', KitchenDisplayView.as_view(), name='pos-kitchen'),
    path('bill/<int:order_id>/', BillReceiptView.as_view(), name='pos-bill'),
    path('dashboard/', DashboardIndexView.as_view(), name='dashboard-index'),
]
