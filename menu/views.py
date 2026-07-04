from rest_framework import viewsets
from .models import Category, MenuItem
from .serializers import CategorySerializer, MenuItemSerializer

class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer

    def get_queryset(self):
        all_categories = self.request.query_params.get('all', 'false').lower() == 'true'
        if all_categories:
            return Category.objects.all().order_by('name')
        return Category.objects.filter(is_active=True).order_by('name')

class MenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer

    def get_queryset(self):
        category_id = self.request.query_params.get('category')
        all_items = self.request.query_params.get('all', 'false').lower() == 'true'
        
        if all_items:
            queryset = MenuItem.objects.all().order_by('name')
        else:
            queryset = MenuItem.objects.filter(is_available=True).order_by('name')
            
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        return queryset

