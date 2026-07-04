from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Rebrand Django Admin Panel
admin.site.site_header = "Food Heaven POS"
admin.site.site_title = "Food Heaven POS Portal"
admin.site.index_title = "Welcome to Food Heaven POS Administration Portal"

urlpatterns = [
    path('admin/', admin.site.urls),
    path('admin-panel/', include('dashboard.urls_admin_panel')),
    
    # API endpoints
    path('api/', include([
        path('', include('menu.urls')),
        path('', include('orders.urls')),
        path('', include('payments.urls')),
        path('', include('dashboard.urls_api')),
    ])),
    
    # Frontend Views (POS, Kitchen, Bill, Dashboard Pages)
    path('', include('dashboard.urls_frontend')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
