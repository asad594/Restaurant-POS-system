from django.shortcuts import redirect
from django.contrib.auth.views import LoginView, LogoutView
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.views.generic import TemplateView

class StaffRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    login_url = '/admin-panel/login/'
    redirect_field_name = 'next'

    def test_func(self):
        return self.request.user.is_active and (self.request.user.is_staff or self.request.user.is_superuser)

class AdminPanelLoginView(LoginView):
    template_name = 'admin_panel/login.html'
    
    def get_success_url(self):
        next_url = self.request.GET.get('next')
        if next_url:
            return next_url
        return '/admin-panel/'

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser):
            return redirect('/admin-panel/')
        return super().dispatch(request, *args, **kwargs)

class AdminPanelLogoutView(LogoutView):
    next_page = '/admin-panel/login/'

class AdminPanelDashboardView(StaffRequiredMixin, TemplateView):
    template_name = 'admin_panel/dashboard.html'

class AdminPanelCategoriesView(StaffRequiredMixin, TemplateView):
    template_name = 'admin_panel/categories.html'

class AdminPanelMenuItemsView(StaffRequiredMixin, TemplateView):
    template_name = 'admin_panel/menu_items.html'

class AdminPanelOrdersView(StaffRequiredMixin, TemplateView):
    template_name = 'admin_panel/orders.html'

class AdminPanelTablesView(StaffRequiredMixin, TemplateView):
    template_name = 'admin_panel/tables.html'

class AdminPanelPaymentsView(StaffRequiredMixin, TemplateView):
    template_name = 'admin_panel/payments.html'


from django.db.models import Sum, Max, Avg, Count
from .models import DailyRevenue

class AdminDailyRevenueView(StaffRequiredMixin, TemplateView):
    template_name = 'admin_panel/daily_revenue.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        records = DailyRevenue.objects.all().order_by('-date')
        
        aggregates = records.aggregate(
            total_days=Count('id'),
            all_time_revenue=Sum('total_revenue'),
            best_day_revenue=Max('total_revenue'),
            avg_daily_revenue=Avg('total_revenue')
        )
        
        context['records'] = records
        context['total_days'] = aggregates['total_days'] or 0
        context['all_time_revenue'] = aggregates['all_time_revenue'] or 0.00
        context['best_day_revenue'] = aggregates['best_day_revenue'] or 0.00
        context['avg_daily_revenue'] = aggregates['avg_daily_revenue'] or 0.00
        return context

