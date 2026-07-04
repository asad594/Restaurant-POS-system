from rest_framework import serializers
from .models import Category, MenuItem

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'image', 'is_active']

class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    
    class Meta:
        model = MenuItem
        fields = ['id', 'category', 'category_name', 'name', 'size', 'price', 'image', 'description', 'is_available']
