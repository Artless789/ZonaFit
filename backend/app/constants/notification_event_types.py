class NotificationEventType:
    # Membresías
    MEMBERSHIP_EXPIRY = "MEMBERSHIP_EXPIRY"        # Membresía próxima a vencer
    MEMBERSHIP_SOLD = "MEMBERSHIP_SOLD"              # Nueva membresía asignada
    MEMBERSHIP_EXPIRED = "MEMBERSHIP_EXPIRED"        # Membresía ya venció
    # Pagos
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"            # Pago de membresía recibido
    PAYMENT_OVERDUE = "PAYMENT_OVERDUE"              # Pago vencido/mora
    # Créditos
    CREDIT_CREATED = "CREDIT_CREATED"                # Nuevo crédito registrado
    CREDIT_PAYMENT_RECEIVED = "CREDIT_PAYMENT_RECEIVED"  # Abono a crédito recibido
    CREDIT_OVERDUE = "CREDIT_OVERDUE"                # Crédito vencido
    # General
    WELCOME = "WELCOME"                              # Bienvenida cliente nuevo
    GENERAL = "GENERAL"                              # Aviso general
    GROUP_INVITATION = "GROUP_INVITATION"            # Invitación a grupo de WhatsApp
