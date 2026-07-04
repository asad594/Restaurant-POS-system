from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DashboardStatsAPIView, UserViewSet, EndOfDayAPIView, DailyRevenueAPIView

router = DefaultRouter()
router.register('users', UserViewSet, basename='users')

urlpatterns = [
    path('dashboard/stats/', DashboardStatsAPIView.as_view(), name='api-dashboard-stats'),
    path('dashboard/end-of-day/', EndOfDayAPIView.as_view(), name='api-end-of-day'),
    path('dashboard/daily-revenue/', DailyRevenueAPIView.as_view(), name='api-daily-revenue'),
    path('', include(router.urls)),
]

