from django.urls import path
from .views_admin_panel import (
    AdminPanelLoginView,
    AdminPanelLogoutView,
    AdminPanelDashboardView,
    AdminPanelCategoriesView,
    AdminPanelMenuItemsView,
    AdminPanelOrdersView,
    AdminPanelTablesView,
    AdminPanelPaymentsView,
    AdminDailyRevenueView
)

urlpatterns = [
    path('', AdminPanelDashboardView.as_view(), name='admin-panel-dashboard'),
    path('categories/', AdminPanelCategoriesView.as_view(), name='admin-panel-categories'),
    path('menu-items/', AdminPanelMenuItemsView.as_view(), name='admin-panel-menu-items'),
    path('orders/', AdminPanelOrdersView.as_view(), name='admin-panel-orders'),
    path('tables/', AdminPanelTablesView.as_view(), name='admin-panel-tables'),
    path('payments/', AdminPanelPaymentsView.as_view(), name='admin-panel-payments'),
    path('daily-revenue/', AdminDailyRevenueView.as_view(), name='admin_daily_revenue'),
    path('login/', AdminPanelLoginView.as_view(), name='admin-panel-login'),
    path('logout/', AdminPanelLogoutView.as_view(), name='admin-panel-logout'),
]

