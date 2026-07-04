from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from menu.models import Category, MenuItem
from orders.models import Table, Order, OrderItem
from payments.models import Payment
import decimal

class POSTestCase(TestCase):
    def setUp(self):
        # Create Category
        self.category = Category.objects.create(name="Burgers", is_active=True)
        
        # Create MenuItems
        self.burger = MenuItem.objects.create(
            category=self.category,
            name="Classic Cheeseburger",
            price=decimal.Decimal("8.99"),
            is_available=True
        )
        self.drink = MenuItem.objects.create(
            category=self.category,
            name="Soda",
            price=decimal.Decimal("1.99"),
            is_available=True
        )

        # Create Table
        self.table = Table.objects.create(number=5, status="free")

    def test_order_subtotal_calculation(self):
        # Create Order
        order = Order.objects.create(table=self.table, status="pending")
        
        # Add OrderItems
        item1 = OrderItem.objects.create(order=order, menu_item=self.burger, quantity=2)
        item2 = OrderItem.objects.create(order=order, menu_item=self.drink, quantity=1)
        
        # Check Item Subtotals
        self.assertEqual(item1.subtotal, decimal.Decimal("17.98"))
        self.assertEqual(item2.subtotal, decimal.Decimal("1.99"))
        
        # Check Order Total
        order.refresh_from_db()
        self.assertEqual(order.total_amount, decimal.Decimal("19.97"))

    def test_payment_processing(self):
        # Create Order and Items
        order = Order.objects.create(table=self.table, status="pending")
        self.table.status = "occupied"
        self.table.save()
        
        OrderItem.objects.create(order=order, menu_item=self.burger, quantity=1)
        order.refresh_from_db() # total should be 8.99
        
        # Process Cash Payment
        # grand total = 8.99 * 1.10 = 9.889 (rounds to 9.89)
        # amount_paid = 15.00
        # change should be = 15.00 - 9.89 = 5.11
        payment = Payment.objects.create(order=order, method="cash", amount_paid=decimal.Decimal("15.00"))
        
        self.assertEqual(payment.change_returned, decimal.Decimal("5.11"))
        
        # Check order and table statuses transitioned correctly
        order.refresh_from_db()
        self.table.refresh_from_db()
        self.assertEqual(order.status, "served")
        self.assertEqual(self.table.status, "free")

    def test_takeaway_order_processing(self):
        # Create a takeaway order (table=None)
        order = Order.objects.create(table=None, status="pending")
        self.assertEqual(order.table, None)
        self.assertEqual(order.table_number, "Takeaway")
        
        OrderItem.objects.create(order=order, menu_item=self.burger, quantity=1)
        order.refresh_from_db()
        self.assertEqual(order.total_amount, decimal.Decimal("8.99"))
        
        # Process Cash Payment for takeaway order
        payment = Payment.objects.create(order=order, method="cash", amount_paid=decimal.Decimal("15.00"))
        
        self.assertEqual(payment.change_returned, decimal.Decimal("5.11"))
        
        # Check order status transitioned correctly, and order.table remains None
        order.refresh_from_db()
        self.assertEqual(order.status, "served")
        self.assertEqual(order.table, None)

    def test_create_order_on_occupied_table(self):
        # Occupy the table
        self.table.status = "occupied"
        self.table.save()

        # Try to place order via API
        import json
        url = "/api/orders/create/"
        data = {
            "table": self.table.id,
            "items": [
                {
                    "menu_item": self.burger.id,
                    "quantity": 1
                }
            ]
        }
        response = self.client.post(url, json.dumps(data), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("table", response.data)
        self.assertEqual(response.data["table"][0], "This table is already occupied.")

    def test_auto_payment_creation_on_manually_served(self):
        order = Order.objects.create(table=self.table, status="pending")
        OrderItem.objects.create(order=order, menu_item=self.burger, quantity=2)
        order.refresh_from_db()
        
        import json
        url = f"/api/orders/{order.id}/update-status/"
        data = {"status": "served"}
        response = self.client.put(url, json.dumps(data), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        
        from payments.models import Payment
        payment = Payment.objects.filter(order=order).first()
        self.assertIsNotNone(payment)
        self.assertEqual(payment.method, "cash")
        self.assertEqual(payment.amount_paid, decimal.Decimal("19.78"))

    def test_end_of_day_closes_earliest_unclosed_day(self):
        from datetime import timedelta
        from dashboard.models import DailyRevenue
        from django.urls import reverse
        from django.contrib.auth.models import User
        
        # Create a user and log in to client
        user = User.objects.create_superuser(username="admin", password="password")
        self.client.force_login(user)

        # Set up a business day date for yesterday
        now_local = timezone.localtime(timezone.now())
        yesterday_date = now_local.date() - timedelta(days=1)
        
        # Yesterday's business hours: 3 AM yesterday to 2:59:59 AM today
        # Create an order and payment on yesterday's business day (e.g. yesterday at 12:00 PM)
        yesterday_midday = timezone.make_aware(timezone.datetime(
            yesterday_date.year, yesterday_date.month, yesterday_date.day, 12, 0, 0
        ))
        
        order = Order.objects.create(table=self.table, status="pending")
        OrderItem.objects.create(order=order, menu_item=self.burger, quantity=2)
        order.refresh_from_db()
        
        payment = Payment.objects.create(order=order, method="cash", amount_paid=decimal.Decimal("25.00"))
        
        # Force the timestamps to yesterday midday
        Order.objects.filter(id=order.id).update(created_at=yesterday_midday)
        Payment.objects.filter(id=payment.id).update(timestamp=yesterday_midday)
        
        # Yesterday is unclosed.
        # Now trigger the EOD API
        url = reverse('api-end-of-day')
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        
        # The EOD API response should have closed yesterday_date!
        self.assertEqual(response.data['date'], yesterday_date.strftime('%Y-%m-%d'))
        self.assertEqual(response.data['total_orders'], 1)
        
        # A DailyRevenue record should now exist for yesterday_date
        self.assertTrue(DailyRevenue.objects.filter(date=yesterday_date).exists())
        
        # Verify that the orders and payments from yesterday are kept in database for records/ledger
        self.assertTrue(Order.objects.filter(id=order.id).exists())
        self.assertTrue(Payment.objects.filter(id=payment.id).exists())

    def test_get_next_close_day_self_healing(self):
        from dashboard.views import get_next_close_day
        from dashboard.models import DailyRevenue
        
        # Create a closed day date
        closed_date = timezone.localtime(timezone.now()).date() - timedelta(days=2)
        
        # Create DailyRevenue for closed_date
        DailyRevenue.objects.create(
            date=closed_date,
            total_orders=1,
            total_revenue=decimal.Decimal("10.00"),
            cash_revenue=decimal.Decimal("10.00"),
            card_revenue=decimal.Decimal("0.00")
        )
        
        # Create a lingering order on that day
        order_time = timezone.make_aware(timezone.datetime(
            closed_date.year, closed_date.month, closed_date.day, 12, 0, 0
        ))
        order = Order.objects.create(table=self.table, status="pending")
        Order.objects.filter(id=order.id).update(created_at=order_time)
        
        # Run get_next_close_day() to trigger self-healing
        get_next_close_day()
        
        # Verify that the lingering order is kept in database for records/ledger
        self.assertTrue(Order.objects.filter(id=order.id).exists())

