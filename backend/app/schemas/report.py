from datetime import date
from decimal import Decimal

from pydantic import BaseModel


# ----------------------------
# Reporte General de Ventas
# ----------------------------

class SalesReportResponse(BaseModel):
    total_sales: int
    total_income: Decimal


# ----------------------------
# Ventas por Fecha
# ----------------------------

class SalesByDateResponse(BaseModel):
    start_date: date
    end_date: date
    total_sales: int
    total_income: Decimal


# ----------------------------
# Ventas por Cliente
# ----------------------------

class SalesByClientResponse(BaseModel):
    client_id: int
    client_name: str
    total_sales: int
    total_amount: Decimal


# ----------------------------
# Productos Más Vendidos
# ----------------------------

class TopProductResponse(BaseModel):
    product_id: int
    product_name: str
    total_quantity: int
    total_amount: Decimal


# ----------------------------
# Productos con Bajo Stock
# ----------------------------

class LowStockProductResponse(BaseModel):
    product_id: int
    product_name: str
    stock: int
    min_stock: int


# ----------------------------
# Pagos por Método
# ----------------------------

class PaymentMethodReportResponse(BaseModel):
    payment_method: str
    total_payments: int
    total_amount: Decimal


# ----------------------------
# Membresías Próximas a Vencer
# ----------------------------

class MembershipExpiringResponse(BaseModel):
    membership_id: int
    client_id: int
    client_name: str
    end_date: date
    days_remaining: int