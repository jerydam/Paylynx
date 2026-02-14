# tip403_policy.py - Updated for user-specific settings

from web3 import Web3

from typing import Optional, Dict

from datetime import datetime

from supabase import Client

# TIP-403 Registry on Tempo (you found this earlier!)

TIP403_REGISTRY_ADDRESS = "0x403c000000000000000000000000000000000000"

DEFAULT_SETTINGS = {
    "enabled": True,
    "max_single_payment": 1000.0,  # $1000 USDC
    "max_daily_limit": 5000.0,  # $5000 per day
    "night_hour_start": 22,  # 10 PM
    "night_hour_end": 6,  # 6 AM
    "night_max_payment": 100.0,  # $100 during night
    "night_time_enabled": True
}

class TIP403PolicyChecker:
    """
    Simple policy checker that demonstrates TIP-403 awareness
    This runs BEFORE your normal USDC transfer
    """

    def __init__(self, db: Client):
        self.db = db
        # Track daily spending (in production, store in Supabase)
        self.daily_spending = {}  # user_id -> {amount, reset_time}

    def get_user_settings(self, user_id: str) -> Dict:
        """Fetch user-specific policy settings from DB"""
        response = self.db.table("paylynx_user_profiles") \
            .select("policy_settings") \
            .eq("user_id", user_id) \
            .execute()
        
        if response.data and len(response.data) > 0:
            settings = response.data[0].get("policy_settings")
            if settings:
                return settings
        
        # Fallback to defaults if not found or null
        return DEFAULT_SETTINGS

    def check_payment(
        self,
        user_id: str,
        amount: float,
        recipient: str,
        context: str = ""
    ) -> Dict:
        """
        Check if payment is allowed by policy
        
        Returns: {allowed: bool, reason: str, policy_name: str}
        """
        # Load user-specific settings
        settings = self.get_user_settings(user_id)
        
        if not settings.get("enabled", True):
            return {
                "allowed": True,
                "reason": "TIP-403 policy is disabled for this user",
                "policy": "TIP-403 Disabled",
                "daily_spent": 0,
                "daily_remaining": 0
            }

        # Check 1: Single payment limit
        if amount > settings["max_single_payment"]:
            return {
                "allowed": False,
                "reason": f"Amount ${amount:.2f} exceeds single payment limit of ${settings['max_single_payment']:.2f}",
                "policy": "TIP-403 Single Payment Limit",
                "blocked_by": "max_single_payment"
            }

        # Check 2: Daily limit
        today = datetime.now().date()
        if user_id in self.daily_spending:
            spent_data = self.daily_spending[user_id]
            if spent_data['date'] == today:
                total = spent_data['amount'] + amount
                if total > settings["max_daily_limit"]:
                    return {
                        "allowed": False,
                        "reason": f"Daily limit exceeded. Spent: ${spent_data['amount']:.2f}, This payment: ${amount:.2f}, Limit: ${settings['max_daily_limit']:.2f}",
                        "policy": "TIP-403 Daily Spending Limit",
                        "blocked_by": "max_daily_limit",
                        "daily_spent": spent_data['amount'],
                        "daily_remaining": settings["max_daily_limit"] - spent_data['amount']
                    }

        # Check 3: Night time restrictions
        current_hour = datetime.now().hour
        is_night = settings.get("night_time_enabled", True) and (
            current_hour >= settings["night_hour_start"] or current_hour < settings["night_hour_end"]
        )

        if is_night and amount > settings["night_max_payment"]:
            return {
                "allowed": False,
                "reason": f"Night time payments limited to ${settings['night_max_payment']:.2f}. Current amount: ${amount:.2f}",
                "policy": "TIP-403 Time-Based Restriction",
                "blocked_by": "night_time_limit",
                "time": f"{current_hour}:00"
            }

        # All checks passed!
        # Update daily spending
        if user_id not in self.daily_spending or self.daily_spending[user_id]['date'] != today:
            self.daily_spending[user_id] = {'date': today, 'amount': 0}

        self.daily_spending[user_id]['amount'] += amount

        return {
            "allowed": True,
            "reason": "Payment approved - all TIP-403 policy checks passed",
            "policy": "TIP-403 Compliant",
            "daily_spent": self.daily_spending[user_id]['amount'],
            "daily_remaining": settings["max_daily_limit"] - self.daily_spending[user_id]['amount']
        }

    def get_policy_info(self, user_id: str) -> Dict:
        """Get current policy limits and user's status"""
        settings = self.get_user_settings(user_id)
        
        today = datetime.now().date()
        current_hour = datetime.now().hour
        is_night = settings.get("night_time_enabled", True) and (
            current_hour >= settings["night_hour_start"] or current_hour < settings["night_hour_end"]
        )

        daily_spent = 0
        if user_id in self.daily_spending and self.daily_spending[user_id]['date'] == today:
            daily_spent = self.daily_spending[user_id]['amount']

        return {
            "policy_framework": "TIP-403",
            "registry_address": TIP403_REGISTRY_ADDRESS,
            "limits": {
                "max_single_payment": settings["max_single_payment"],
                "max_daily_limit": settings["max_daily_limit"],
                "night_max_payment": settings["night_max_payment"],
                "night_hours": f"{settings['night_hour_start']}:00 - {settings['night_hour_end']}:00"
            },
            "user_status": {
                "daily_spent": daily_spent,
                "daily_remaining": settings["max_daily_limit"] - daily_spent,
                "is_night_time": is_night,
                "current_max_payment": settings["night_max_payment"] if is_night else settings["max_single_payment"]
            }
        }