'use client';

import React, { useState, useEffect } from "react";
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createPublicClient, http, formatUnits } from 'viem';
import { QRCodeSVG } from 'qrcode.react';
import { tempo } from 'viem/chains';
import { toast } from "sonner";

interface DashboardProps {
  onOpenChat: () => void;
}

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_seed: string;
  unique_username: string;
  bio: string | null;
  notifications_enabled: boolean;
  transaction_confirmations_enabled: boolean;
  biometric_auth_enabled: boolean;
  created_at: string;
  updated_at: string | null;
}

interface Transaction {
  id: string;
  tx_hash: string;
  amount: number;
  recipient: string;
  recipient_name: string | null;
  status: string;
  created_at: string;
}

interface PolicySettings {
  enabled: boolean;
  max_single_payment: number;
  max_daily_limit: number;
  night_time_enabled: boolean;
  night_max_payment: number;
  night_hour_start: number;
  night_hour_end: number;
}

// Settings navigation type
type SettingsPage = 'menu' | 'profile' | 'security' | 'policy' | 'preferences' | 'support';

export const DashboardPage: React.FC<DashboardProps> = ({ onOpenChat }) => {
  const { user: appUser, logout: appLogout } = useApp();
  const { ready, authenticated, user: privyUser, getAccessToken, logout: privyLogout, exportWallet } = usePrivy();
  const { wallets } = useWallets();

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showFundModal, setShowFundModal] = useState(false);
  const [realBalance, setRealBalance] = useState<string>('0.00');
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTxs, setIsLoadingTxs] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountAddress, setAccountAddress] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showViewAccountsModal, setShowViewAccountsModal] = useState(false);

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txReceipt, setTxReceipt] = useState<any>(null);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

  const [showHistoryPage, setShowHistoryPage] = useState(false);

  // NEW: Settings navigation state
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [currentSettingsPage, setCurrentSettingsPage] = useState<SettingsPage>('menu');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    email: '',
    bio: '',
    notifications_enabled: true,
    transaction_confirmations_enabled: true,
    biometric_auth_enabled: false
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [policySettings, setPolicySettings] = useState<PolicySettings>({
    enabled: true,
    max_single_payment: 1000,
    max_daily_limit: 5000,
    night_time_enabled: true,
    night_max_payment: 100,
    night_hour_start: 22,
    night_hour_end: 6
  });
  const [policyInfo, setPolicyInfo] = useState<any>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const USDC_ADDRESS = '0x20c0000000000000000000000000000000000000' as const;
  
  const publicClient = createPublicClient({
    chain: tempo,
    transport: http('https://rpc.moderato.tempo.xyz'),
  });

  // Get Privy embedded wallet
  useEffect(() => {
    if (!ready || !authenticated || !wallets.length) return;
    
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
    
    if (embeddedWallet) {
      console.log('Using Privy embedded wallet:', embeddedWallet.address);
      setWalletAddress(embeddedWallet.address);
    } else {
      console.log('No Privy embedded wallet found');
      setWalletAddress(null);
    }
  }, [ready, authenticated, wallets]);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!authenticated) return;
      
      setIsLoadingProfile(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) throw new Error('Failed to load profile');
        
        const data: UserProfile = await res.json();
        setUserProfile(data);
        
        setProfileForm({
          display_name: data.display_name || '',
          email: data.email || '',
          bio: data.bio || '',
          notifications_enabled: data.notifications_enabled,
          transaction_confirmations_enabled: data.transaction_confirmations_enabled,
          biometric_auth_enabled: data.biometric_auth_enabled
        });
        
        console.log('✅ Profile loaded:', data.unique_username);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [authenticated, getAccessToken]);

  // Fetch TIP-403 Policy Info
  useEffect(() => {
    const fetchPolicyInfo = async () => {
      if (!authenticated) return;
      
      setIsLoadingPolicy(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE_URL}/policy/limits`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (res.ok) {
          const data = await res.json();
          setPolicyInfo(data);
          
          if (data.limits) {
            setPolicySettings(prev => ({
              ...prev,
              enabled: data.enabled !== undefined ? data.enabled : prev.enabled,
              max_single_payment: data.limits.max_single_payment,
              max_daily_limit: data.limits.max_daily_limit,
              night_max_payment: data.limits.night_max_payment
            }));
          }
          
          console.log('✅ Policy info loaded:', data);
        }
      } catch (err) {
        console.error('Failed to fetch policy info:', err);
      } finally {
        setIsLoadingPolicy(false);
      }
    };

    if (showSettingsPage && currentSettingsPage === 'policy') {
      fetchPolicyInfo();
    }
  }, [authenticated, getAccessToken, showSettingsPage, currentSettingsPage]);

  // Fetch real USDC balance
  useEffect(() => {
    if (!walletAddress) return;
    setIsBalanceLoading(true);

    const fetchBalance = async () => {
      try {
        const balanceRaw = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: [{ 
            name: 'balanceOf', 
            type: 'function', 
            stateMutability: 'view', 
            inputs: [{ type: 'address' }], 
            outputs: [{ type: 'uint256' }] 
          }],
          functionName: 'balanceOf',
          args: [walletAddress as `0x${string}`],
        });
        
        const formatted = formatUnits(balanceRaw, 6);
        const numericBalance = parseFloat(formatted);
        
        const displayBalance = numericBalance < 1 
          ? numericBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
          : numericBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        setRealBalance(displayBalance);
      } catch (err) {
        console.error('Balance fetch failed:', err);
        setRealBalance('0.00');
      } finally {
        setIsBalanceLoading(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  // Fetch saved accounts from backend
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE_URL}/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load accounts');
        const data = await res.json();
        setSavedAccounts(data);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      }
    };

    if (authenticated) fetchAccounts();
  }, [authenticated, getAccessToken]);

  // Fetch real transaction history from backend
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!authenticated) return;
      
      setIsLoadingTxs(true);
      setTxError(null);

      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE_URL}/transactions?limit=50`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to load transactions: ${res.status}`);
        }

        const data: Transaction[] = await res.json();
        
        const verifiedTransactions = await Promise.all(
          data.map(async (tx) => {
            try {
              const receipt = await publicClient.getTransactionReceipt({
                hash: tx.tx_hash as `0x${string}`,
              });
              
              const actualStatus = receipt.status === 'success' ? 'completed' : 'failed';
              
              return { ...tx, status: actualStatus };
            } catch (err) {
              return { ...tx, status: tx.status || 'pending' };
            }
          })
        );
        
        setTransactions(verifiedTransactions);
      } catch (err: any) {
        setTxError(err.message || 'Failed to load transaction history');
      } finally {
        setIsLoadingTxs(false);
      }
    };

    fetchTransactions();
    const interval = setInterval(fetchTransactions, 30000);
    return () => clearInterval(interval);
  }, [authenticated, getAccessToken]);

  const fetchTxReceipt = async (txHash: string) => {
    setIsLoadingReceipt(true);
    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
      
      setTxReceipt({
        status: receipt.status,
        confirmed: receipt.status === 'success',
        block_number: receipt.blockNumber.toString(),
        gas_used: receipt.gasUsed.toString(),
        transaction_hash: receipt.transactionHash,
      });
    } catch (err) {
      setTxReceipt({ status: 'pending', confirmed: false });
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const handleLogout = () => {
    privyLogout();
    if (appLogout) appLogout();
    window.location.href = '/';
  };

  const handleExportWallet = async () => {
    try {
      if (exportWallet) {
        await exportWallet();
      } else {
        toast.warning('⚠️ Wallet export is not available. Please check Privy configuration.');
      }
    } catch (err) {
      console.error('Export wallet error:', err);
      toast.error('❌ Failed to export wallet. Please try again.');
    }
  };

  const handleSavePreferences = async () => {
  try {
    const token = await getAccessToken();
    const payload = {
      notifications_enabled: profileForm.notifications_enabled,
      transaction_confirmations_enabled: profileForm.transaction_confirmations_enabled,
      biometric_auth_enabled: profileForm.biometric_auth_enabled,
    };

    const res = await fetch(`${API_BASE_URL}/profile/preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Failed to save preferences");

    // Refresh full profile to ensure sync
    const profileRes = await fetch(`${API_BASE_URL}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const updatedProfile = await profileRes.json();
    setUserProfile(updatedProfile);

    alert("✅ Preferences saved successfully!");
  } catch (err: any) {
    alert(`❌ ${err.message || "Error saving preferences"}`);
  }
};

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
  try {
    const token = await getAccessToken();
    const payload: Partial<UserProfile> = {};

    // Only include fields that have changed or are set
    if (profileForm.display_name !== userProfile?.display_name) {
      payload.display_name = profileForm.display_name || null;
    }
    if (profileForm.email !== userProfile?.email) {
      payload.email = profileForm.email?.trim() || null;
    }
    if (profileForm.bio !== userProfile?.bio) {
      payload.bio = profileForm.bio || null;
    }

    if (Object.keys(payload).length === 0) {
      alert("No changes to save");
      return;
    }

    const res = await fetch(`${API_BASE_URL}/profile/basic`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Failed to save basic profile");

    const updated = await res.json();
    setUserProfile(updated);
    setIsEditingProfile(false);
    alert("✅ Basic profile updated successfully!");
  } catch (err: any) {
    alert(`❌ ${err.message || "Error saving profile"}`);
  } finally {
    setIsSavingProfile(false);
  }
};

  const handleSavePolicySettings = async () => {
  setIsSavingPolicy(true);
  try {
    const token = await getAccessToken();

    const res = await fetch(`${API_BASE_URL}/policy/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(policySettings),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Failed to save policy settings");
    }

    alert("✅ TIP-403 policy settings saved and will be enforced on all transactions!");

    // Optional: refresh policy info display
    const policyRes = await fetch(`${API_BASE_URL}/policy/limits`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const policyData = await policyRes.json();
    setPolicyInfo(policyData);
  } catch (err: any) {
    alert(`❌ ${err.message || "Error saving policy settings"}`);
  } finally {
    setIsSavingPolicy(false);
  }
};

  const isEvmAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr.trim());

  const handleAddAccount = async () => {
    setAddError('');
    if (!accountName.trim() || !accountAddress.trim()) {
      setAddError('Both name and address are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE_URL}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: accountName.trim(),
          address: accountAddress.trim(),
          chain_id: 84532,
          type: isEvmAddress(accountAddress) ? 'evm' : 'other',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save account');
      }

      toast.success('✅ Account saved successfully!');
      setShowAddAccountModal(false);
      setAccountName('');
      setAccountAddress('');

      const updatedRes = await fetch(`${API_BASE_URL}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = await updatedRes.json();
      setSavedAccounts(updated);

    } catch (err: any) {
      setAddError(err.message || 'Error saving account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete account');

      const updatedRes = await fetch(`${API_BASE_URL}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = await updatedRes.json();
      setSavedAccounts(updated);
      
      toast.success('✅ Account deleted successfully!');
    } catch (err: any) {
      toast.error(`❌ ${err.message || 'Error deleting account'}`);
    }
  };

  const handleViewTxDetails = (tx: Transaction) => {
    setSelectedTx(tx);
    setTxReceipt(null);
    fetchTxReceipt(tx.tx_hash);
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase().trim();
    
    switch (normalizedStatus) {
      case 'completed':
      case 'success':
        return (
          <span className="text-green-400 font-medium flex items-center gap-1 text-xs">
            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="text-yellow-400 font-medium flex items-center gap-1 text-xs">
            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            Pending
          </span>
        );
      case 'failed':
      case 'reverted':
        return (
          <span className="text-red-400 font-medium flex items-center gap-1 text-xs">
            <span className="inline-block w-2 h-2 bg-red-400 rounded-full" />
            Failed
          </span>
        );
      default:
        return <span className="text-slate-400 text-xs capitalize">{status}</span>;
    }
  };

  // NEW: Navigate to settings subpage
  const openSettingsPage = (page: SettingsPage) => {
    setCurrentSettingsPage(page);
    setShowSettingsPage(true);
  };

  // NEW: Back handler for settings
  const handleSettingsBack = () => {
    if (currentSettingsPage === 'menu') {
      setShowSettingsPage(false);
    } else {
      setCurrentSettingsPage('menu');
    }
  };

  if (!ready || isLoadingProfile) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p>Loading...</p>
      </div>
    </div>
  );
  
  if (!authenticated) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
      <p>Please log in</p>
    </div>
  );

  const displayAddress = walletAddress ? `${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}` : 'Not connected';

  // ============================================================================
  // SETTINGS PAGES
  // ============================================================================
  if (showSettingsPage) {
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-24">
        {/* Header */}
        <header className="flex items-center gap-4 p-6 glass border-b border-white/5 sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl">
          <button 
            onClick={handleSettingsBack}
            className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold gradient-text">
              {currentSettingsPage === 'menu' ? 'Settings' :
               currentSettingsPage === 'profile' ? 'Profile' :
               currentSettingsPage === 'security' ? 'Security' :
               currentSettingsPage === 'policy' ? 'TIP-403 Protection' :
               currentSettingsPage === 'preferences' ? 'Preferences' : 'Support'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {currentSettingsPage === 'menu' && 'Manage your account and preferences'}
              {currentSettingsPage === 'profile' && 'Update your personal information'}
              {currentSettingsPage === 'security' && 'Wallet and security settings'}
              {currentSettingsPage === 'policy' && 'Configure payment protection limits'}
              {currentSettingsPage === 'preferences' && 'App preferences and notifications'}
              {currentSettingsPage === 'support' && 'Help and information'}
            </p>
          </div>
        </header>

        <main className="p-6 max-w-2xl mx-auto">
          
          {/* SETTINGS MENU */}
          {currentSettingsPage === 'menu' && (
            <div className="space-y-3">
              <button
                onClick={() => setCurrentSettingsPage('profile')}
                className="w-full flex items-center justify-between p-5 rounded-2xl glass bg-slate-900/50 border border-slate-700 hover:bg-slate-800 hover:border-teal-500/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-500 flex items-center justify-center text-2xl">
                    👤
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white group-hover:text-teal-400 transition-colors">Profile</p>
                    <p className="text-xs text-slate-400">Edit your personal information</p>
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-teal-400 transition-colors">→</span>
              </button>

              <button
                onClick={() => setCurrentSettingsPage('security')}
                className="w-full flex items-center justify-between p-5 rounded-2xl glass bg-slate-900/50 border border-slate-700 hover:bg-slate-800 hover:border-teal-500/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-400 to-pink-500 flex items-center justify-center text-2xl">
                    🔐
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white group-hover:text-teal-400 transition-colors">Security</p>
                    <p className="text-xs text-slate-400">Wallet and authentication</p>
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-teal-400 transition-colors">→</span>
              </button>

              <button
                onClick={() => setCurrentSettingsPage('policy')}
                className="w-full flex items-center justify-between p-5 rounded-2xl glass bg-gradient-to-br from-teal-900/20 to-emerald-900/20 border border-teal-500/30 hover:border-teal-500/50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-2xl shadow-lg shadow-teal-500/30">
                    🛡️
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white group-hover:text-teal-400 transition-colors">TIP-403 Protection</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono">ACTIVE</span>
                    </div>
                    <p className="text-xs text-slate-400">Payment safety limits</p>
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-teal-400 transition-colors">→</span>
              </button>

              <button
                onClick={() => setCurrentSettingsPage('preferences')}
                className="w-full flex items-center justify-between p-5 rounded-2xl glass bg-slate-900/50 border border-slate-700 hover:bg-slate-800 hover:border-teal-500/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 to-cyan-500 flex items-center justify-center text-2xl">
                    ⚙️
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white group-hover:text-teal-400 transition-colors">Preferences</p>
                    <p className="text-xs text-slate-400">Notifications and app settings</p>
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-teal-400 transition-colors">→</span>
              </button>

              <button
                onClick={() => setCurrentSettingsPage('support')}
                className="w-full flex items-center justify-between p-5 rounded-2xl glass bg-slate-900/50 border border-slate-700 hover:bg-slate-800 hover:border-teal-500/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-2xl">
                    💬
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white group-hover:text-teal-400 transition-colors">Support & Info</p>
                    <p className="text-xs text-slate-400">Help and app information</p>
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-teal-400 transition-colors">→</span>
              </button>

              {/* Danger Zone */}
              <div className="mt-8 pt-6 border-t border-slate-800">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Danger Zone</p>
                <div className="space-y-3">
                  <Button
                    onClick={handleLogout}
                    className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300"
                  >
                    🚪 Logout
                  </Button>

                  <Button
                    onClick={async () => {
                      if (confirm('⚠️ Are you sure you want to delete your account? This action cannot be undone!')) {
                        try {
                          const token = await getAccessToken();
                          const res = await fetch(`${API_BASE_URL}/profile`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          
                          if (res.ok) {
                            toast.success('✅ Account deleted successfully');
                            handleLogout();
                          } else {
                            throw new Error('Failed to delete account');
                          }
                        } catch (err: any) {
                          toast.error(`❌ ${err.message}`);
                        }
                      }
                    }}
                    className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-200"
                  >
                    🗑️ Delete Account
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* PROFILE PAGE */}
          {currentSettingsPage === 'profile' && (
            <div className="space-y-6">
              <div className="rounded-2xl glass bg-slate-900/50 border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">Personal Information</h2>
                  {!isEditingProfile && (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="text-sm text-teal-400 hover:text-teal-300"
                    >
                      Edit
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-500 flex items-center justify-center overflow-hidden shadow-lg shadow-teal-500/30">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.avatar_seed || 'default'}`} 
                      alt="Avatar"
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex-1">
                    {isEditingProfile ? (
                      <Input
                        value={profileForm.display_name}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, display_name: e.target.value }))}
                        placeholder="Display Name"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    ) : (
                      <>
                        <h3 className="text-lg font-bold text-white">
                          {userProfile?.display_name || 'Anonymous User'}
                        </h3>
                        <p className="text-sm text-teal-400">@{userProfile?.unique_username}</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Email</label>
                    {isEditingProfile ? (
                      <Input
                        value={profileForm.email}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@example.com"
                        className="bg-slate-800 border-slate-600 text-white"
                        type="email"
                      />
                    ) : (
                      <p className="text-sm text-slate-200">{userProfile?.email || 'Not set'}</p>
                    )}
                  </div>

                  {isEditingProfile && (
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Bio</label>
                      <Textarea
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="Tell us about yourself..."
                        className="bg-slate-800 border-slate-600 text-white resize-none"
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {profileForm.bio.length}/500 characters
                      </p>
                    </div>
                  )}

                  {!isEditingProfile && userProfile?.bio && (
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Bio</label>
                      <p className="text-sm text-slate-200">{userProfile.bio}</p>
                    </div>
                  )}
                </div>

                {isEditingProfile && (
                  <div className="flex gap-3 mt-6">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
                    >
                      {isSavingProfile ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditingProfile(false);
                        if (userProfile) {
                          setProfileForm({
                            display_name: userProfile.display_name || '',
                            email: userProfile.email || '',
                            bio: userProfile.bio || '',
                            notifications_enabled: userProfile.notifications_enabled,
                            transaction_confirmations_enabled: userProfile.transaction_confirmations_enabled,
                            biometric_auth_enabled: userProfile.biometric_auth_enabled
                          });
                        }
                      }}
                      disabled={isSavingProfile}
                      className="flex-1 glass border-slate-600"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl glass bg-slate-900/50 border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Account Details</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">User ID</label>
                    <p className="text-sm text-slate-200 font-mono break-all">{userProfile?.user_id}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Member Since</label>
                    <p className="text-sm text-slate-200">
                      {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY PAGE */}
          {currentSettingsPage === 'security' && (
            <div className="space-y-6">
              <div className="rounded-2xl glass bg-slate-900/50 border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white mb-6">Wallet Information</h2>

                <div className="space-y-4">
                  <div className="bg-slate-800/50 p-4 rounded-xl">
                    <label className="text-xs text-slate-400 mb-2 block">Wallet Address</label>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-200 font-mono flex-1 truncate">
                        {walletAddress || 'Not connected'}
                      </p>
                      <button
                        onClick={() => {
                          if (walletAddress) {
                            navigator.clipboard.writeText(walletAddress);
                            toast.success('✅ Address copied!');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/30 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 p-4 rounded-xl">
                    <label className="text-xs text-slate-400 mb-2 block">Network</label>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      <p className="text-sm text-slate-200">Tempo Testnet </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl glass bg-slate-900/50 border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Backup & Recovery</h2>
                <Button
                  onClick={handleExportWallet}
                  className="w-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300"
                >
                  🔑 Export Private Key / Seed Phrase
                </Button>
                
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-4">
                  ⚠️ Never share your private key or seed phrase with anyone.
                </p>
              </div>
            </div>
          )}

          {/* TIP-403 POLICY PAGE */}
          {currentSettingsPage === 'policy' && (
            <div className="space-y-6">
              {/* Policy Status Summary */}
              {policyInfo && (
                <div className="rounded-2xl glass bg-gradient-to-br from-teal-900/20 to-emerald-900/20 border border-teal-500/30 p-6">
                  <h2 className="text-lg font-bold text-white mb-4">Current Status</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 mb-1">Today's Spending</p>
                      <p className="text-2xl font-bold text-white">
                        ${policyInfo.user_status?.daily_spent?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="bg-slate-950/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 mb-1">Remaining Limit</p>
                      <p className="text-2xl font-bold text-teal-400">
                        ${policyInfo.user_status?.daily_remaining?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Policy Settings */}
              <div className="rounded-2xl glass bg-slate-900/50 border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white mb-6">Protection Settings</h2>

                <div className="space-y-6">
                  {/* Enable/Disable */}
                  <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                    <div>
                      <p className="text-sm font-medium text-white">Enable Protection</p>
                      <p className="text-xs text-slate-400 mt-1">Enforce safety limits</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={policySettings.enabled}
                        onChange={(e) => setPolicySettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                  </div>

                  {/* Single Payment Limit */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-white">Single Payment Limit</label>
                      <span className="text-teal-400 font-mono text-sm">
                        ${policySettings.max_single_payment.toLocaleString()}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="100" 
                      max="10000" 
                      step="100"
                      value={policySettings.max_single_payment}
                      onChange={(e) => setPolicySettings(prev => ({ 
                        ...prev, 
                        max_single_payment: parseInt(e.target.value) 
                      }))}
                      disabled={!policySettings.enabled}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>$100</span>
                      <span>$10,000</span>
                    </div>
                  </div>

                  {/* Daily Limit */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-white">Daily Spending Limit</label>
                      <span className="text-teal-400 font-mono text-sm">
                        ${policySettings.max_daily_limit.toLocaleString()}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="500" 
                      max="50000" 
                      step="500"
                      value={policySettings.max_daily_limit}
                      onChange={(e) => setPolicySettings(prev => ({ 
                        ...prev, 
                        max_daily_limit: parseInt(e.target.value) 
                      }))}
                      disabled={!policySettings.enabled}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>$500</span>
                      <span>$50,000</span>
                    </div>
                  </div>

                  {/* Night Mode */}
                  <div className="border-t border-slate-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-white">🌙 Night Mode</p>
                        <p className="text-xs text-slate-400 mt-1">Lower limits during late hours</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={policySettings.night_time_enabled}
                          onChange={(e) => setPolicySettings(prev => ({ 
                            ...prev, 
                            night_time_enabled: e.target.checked 
                          }))}
                          disabled={!policySettings.enabled}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500 peer-disabled:opacity-50"></div>
                      </label>
                    </div>

                    {policySettings.night_time_enabled && (
                      <div className="space-y-4 bg-slate-950/50 rounded-xl p-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-medium text-slate-300">Night Payment Limit</label>
                            <span className="text-amber-400 font-mono text-xs">
                              ${policySettings.night_max_payment.toLocaleString()}
                            </span>
                          </div>
                          <input 
                            type="range" 
                            min="10" 
                            max="1000" 
                            step="10"
                            value={policySettings.night_max_payment}
                            onChange={(e) => setPolicySettings(prev => ({ 
                              ...prev, 
                              night_max_payment: parseInt(e.target.value) 
                            }))}
                            disabled={!policySettings.enabled}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">Starts At</label>
                            <select 
                              value={policySettings.night_hour_start}
                              onChange={(e) => setPolicySettings(prev => ({ 
                                ...prev, 
                                night_hour_start: parseInt(e.target.value) 
                              }))}
                              disabled={!policySettings.enabled}
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>
                                  {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i-12} PM`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">Ends At</label>
                            <select 
                              value={policySettings.night_hour_end}
                              onChange={(e) => setPolicySettings(prev => ({ 
                                ...prev, 
                                night_hour_end: parseInt(e.target.value) 
                              }))}
                              disabled={!policySettings.enabled}
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                            >
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>
                                  {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i-12} PM`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Save Button */}
                  <Button
                    onClick={handleSavePolicySettings}
                    disabled={isSavingPolicy || !policySettings.enabled}
                    className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 disabled:opacity-50"
                  >
                    {isSavingPolicy ? 'Saving...' : '💾 Save Settings'}
                  </Button>
                </div>
              </div>

              {/* Info Box */}
              <div className="rounded-2xl glass bg-blue-500/10 border border-blue-500/30 p-6">
                <div className="flex gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div>
                    <p className="text-sm font-medium text-blue-300 mb-1">About TIP-403</p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      TIP-403 is Tempo's policy framework for programmable compliance. These settings 
                      create safety rails for AI-initiated payments, protecting you from errors, 
                      fraud, and impulsive decisions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PREFERENCES PAGE */}
          {currentSettingsPage === 'preferences' && (
            <div className="space-y-6">
              <div className="rounded-2xl glass bg-slate-900/50 border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white mb-6">Notifications</h2>

                <div className="space-y-4">
               <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-white">Notifications</p>
                    <p className="text-xs text-slate-400">Get alerts for transactions</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={profileForm.notifications_enabled}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setProfileForm(prev => ({ ...prev, notifications_enabled: newValue }));
                        // Optional: auto-save
                        handleSavePreferences(); // or debounce it
                      }}
                    />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-white">Transaction Confirmations</p>
                      <p className="text-xs text-slate-400 mt-1">Require approval before sending</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={profileForm.transaction_confirmations_enabled}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setProfileForm(prev => ({ ...prev, transaction_confirmations_enabled: newValue }));
                          handleSaveProfile();
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl glass bg-slate-900/50 border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white mb-6">Authentication</h2>

                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-white">Biometric Authentication</p>
                    <p className="text-xs text-slate-400 mt-1">Use Face ID / Touch ID</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={profileForm.biometric_auth_enabled}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setProfileForm(prev => ({ ...prev, biometric_auth_enabled: newValue }));
                        handleSaveProfile();
                      }}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* SUPPORT PAGE */}
          {currentSettingsPage === 'support' && (
            <div className="space-y-6">
              <div className="rounded-2xl glass bg-slate-900/50 border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white mb-6">App Information</h2>
                <div className="space-y-3">
                  <div className="flex justify-between p-4 bg-slate-800/50 rounded-xl">
                    <span className="text-sm text-slate-400">Version</span>
                    <span className="text-sm text-slate-200 font-mono">v2.1.0-beta</span>
                  </div>
                  <div className="flex justify-between p-4 bg-slate-800/50 rounded-xl">
                    <span className="text-sm text-slate-400">Build</span>
                    <span className="text-sm text-slate-200 font-mono">TIP-403 Enabled</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl glass bg-slate-900/50 border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Resources</h2>
                <div className="space-y-2">
                  <a href="#" className="block p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors">
                    <p className="text-sm text-white">Documentation</p>
                    <p className="text-xs text-slate-400 mt-1">Learn how to use Paylynx</p>
                  </a>
                  <a href="#" className="block p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors">
                    <p className="text-sm text-white">Support Center</p>
                    <p className="text-xs text-slate-400 mt-1">Get help with your account</p>
                  </a>
                  <a href="#" className="block p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors">
                    <p className="text-sm text-white">Terms of Service</p>
                    <p className="text-xs text-slate-400 mt-1">Read our terms and conditions</p>
                  </a>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============================================================================
  // HISTORY PAGE VIEW (unchanged - keeping original)
  // ============================================================================
  if (showHistoryPage) {
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-24">
        <header className="flex items-center gap-4 p-6 glass border-b border-white/5 sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl">
          <button 
            onClick={() => setShowHistoryPage(false)}
            className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold gradient-text">Transaction History</h1>
            <p className="text-xs text-slate-400 mt-1">{transactions.length} total transactions</p>
          </div>
        </header>

        <main className="p-6 max-w-2xl mx-auto">
          <div className="space-y-3">
            {isLoadingTxs ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-4 rounded-2xl glass bg-slate-900/50 border border-slate-800/50 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-800 rounded w-32" />
                        <div className="h-3 bg-slate-800 rounded w-24" />
                      </div>
                      <div className="h-5 bg-slate-800 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : txError ? (
              <div className="text-center p-8 border border-dashed border-red-800 rounded-2xl text-red-400">
                <p className="mb-2">❌ {txError}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="text-sm text-teal-400 hover:text-teal-300"
                >
                  Retry
                </button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-slate-800 rounded-2xl text-slate-500">
                <div className="text-6xl mb-4">💸</div>
                <p className="mb-2">No transactions yet</p>
                <p className="text-xs text-slate-600">Start sending with AI!</p>
                <Button
                  onClick={onOpenChat}
                  className="mt-6 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
                >
                  Send Your First Payment
                </Button>
              </div>
            ) : (
              transactions.map((txn) => (
                <div 
                  key={txn.id} 
                  onClick={() => handleViewTxDetails(txn)}
                  className="flex items-center justify-between p-5 rounded-2xl glass bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800 hover:border-teal-500/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center text-2xl">
                      {txn.status === 'completed' || txn.status === 'success' ? '✓' : 
                       txn.status === 'pending' ? '⏳' : '❌'}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-200 group-hover:text-teal-400 transition-colors text-lg">
                        {txn.recipient_name || `${txn.recipient.slice(0,6)}...${txn.recipient.slice(-4)}`}
                      </p>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        {txn.tx_hash.slice(0, 10)}...{txn.tx_hash.slice(-8)}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-slate-500">
                          {new Date(txn.created_at).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {getStatusBadge(txn.status)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-white block text-xl">
                      -${txn.amount.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500">USDC</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    );
  }

  // ============================================================================
  // MAIN DASHBOARD VIEW (unchanged - keeping original)
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 relative">
      
      {/* Top Navigation */}
      <header className="flex justify-between items-center p-6 glass border-b border-white/5 sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-500 flex items-center justify-center overflow-hidden shadow-lg shadow-teal-500/20">
            <img
              src="/log.png"
              className="w-full h-full object-cover"
              alt="Paylynx"
            />
          </div>
          <img
            src="/text.png"
            className="h-6 w-auto"
            alt="Paylynx"
          />
        </div>
        <div className="flex flex-col items-center">
          <div 
            className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden cursor-pointer hover:border-teal-500 transition-colors" 
            onClick={() => openSettingsPage('menu')}
            title="Settings"
          >
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.avatar_seed || 'default'}`} 
              alt="User avatar" 
            />
          </div>
          <span className="text-xs text-teal-400 mt-1">
            @{userProfile?.unique_username || 'user'}
          </span>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        
        {/* Total Balance Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-8 shadow-2xl">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 border border-white/10 p-8 shadow-[0_0_50px_-12px_rgba(20,201,151,0.2)]">
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(20,201,151,0.15),transparent_70%)] pointer-events-none" />
            
            <p className="text-teal-400/80 font-mono text-xs uppercase tracking-[0.2em] mb-2">Available Assets</p>
            
            <div className="flex items-baseline gap-2 mb-8">
              {isBalanceLoading ? (
                <div className="h-16 w-48 bg-slate-800 rounded-lg animate-pulse" />
              ) : (
                <h2 className="text-6xl font-black text-white tracking-tighter">
                  <span className="text-teal-400">$</span>{realBalance.split('.')[0]}
                  <span className="text-2xl text-slate-500">.{realBalance.split('.')[1]}</span>
                </h2>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              onClick={() => setShowFundModal(true)}
              className="flex-1 bg-white text-slate-950 hover:bg-slate-200 font-semibold h-12 rounded-xl shadow-lg transition-transform hover:scale-[1.02]"
            >
              + Add Funds
            </Button>
            <Button 
              className="flex-1 glass bg-slate-800/50 hover:bg-slate-700 border border-slate-600 text-white h-12 rounded-xl transition-transform hover:scale-[1.02]"
            >
              Withdraw
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <button 
            onClick={onOpenChat}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl glass bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800 hover:border-teal-500/30 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-center text-white text-2xl">↗</div>
            <span className="text-xs text-slate-300 font-medium">Send</span>
          </button>
          
          <button 
            onClick={() => setShowAddAccountModal(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl glass bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800 hover:border-teal-500/30 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white text-2xl">+</div>
            <span className="text-xs text-slate-300 font-medium">Add Contact</span>
          </button>
          
          <button 
            onClick={() => setShowViewAccountsModal(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl glass bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800 hover:border-teal-500/30 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl">👥</div>
            <span className="text-xs text-slate-300 font-medium">Contacts</span>
          </button>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-xl font-bold text-slate-200">Recent Activity</h3>
            {transactions.length > 0 && (
              <button 
                onClick={() => setShowHistoryPage(true)}
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                See All →
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {isLoadingTxs ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 rounded-2xl glass bg-slate-900/50 border border-slate-800/50 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-800 rounded w-24" />
                        <div className="h-3 bg-slate-800 rounded w-16" />
                      </div>
                      <div className="h-5 bg-slate-800 rounded w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : txError ? (
              <div className="text-center p-8 border border-dashed border-red-800 rounded-2xl text-red-400">
                <p className="mb-2">❌ {txError}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="text-sm text-teal-400 hover:text-teal-300"
                >
                  Retry
                </button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-slate-800 rounded-2xl text-slate-500">
                <div className="text-5xl mb-3">💸</div>
                <p className="mb-2">No transactions yet</p>
                <p className="text-xs text-slate-600">Start sending with AI!</p>
                <Button
                  onClick={onOpenChat}
                  className="mt-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
                >
                  Send Your First Payment
                </Button>
              </div>
            ) : (
              transactions.slice(0, 3).map((txn) => (
                <div 
                  key={txn.id} 
                  onClick={() => handleViewTxDetails(txn)}
                  className="flex items-center justify-between p-4 rounded-2xl glass bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800 hover:border-teal-500/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center text-xl">
                      {txn.status === 'completed' || txn.status === 'success' ? '✓' : 
                       txn.status === 'pending' ? '⏳' : '❌'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-200 group-hover:text-teal-400 transition-colors">
                        {txn.recipient_name || `${txn.recipient.slice(0,6)}...${txn.recipient.slice(-4)}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-500">
                          {new Date(txn.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {getStatusBadge(txn.status)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-medium text-white block">
                      -${txn.amount.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500">USDC</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
        <button 
          onClick={onOpenChat}
          className="pointer-events-auto group relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/40 hover:scale-110 hover:shadow-teal-400/60 transition-all duration-300 ease-out"
        >
          <span className="absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-20 group-hover:animate-ping" />
          <svg className="w-8 h-8 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      </div>

      {/* All Modals (Fund, Transaction Details, Add Account, View Accounts) - keeping original code */}
      {/* Fund Modal */}
      {showFundModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full text-center relative animate-in zoom-in duration-300">
            <button 
              onClick={() => setShowFundModal(false)} 
              className="absolute top-4 right-4 text-slate-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
            
            <h3 className="text-2xl font-bold mb-2 gradient-text">Fund Your Wallet</h3>
            <p className="text-slate-400 text-sm mb-6">
              Send USDC to your Paylynx wallet on Tempo Testnet
            </p>
            
            <div className="bg-white p-6 rounded-2xl mx-auto w-56 h-56 mb-6 shadow-xl flex items-center justify-center">
              {walletAddress ? (
                <QRCodeSVG
                  value={walletAddress}
                  size={200}
                  level="H"
                  fgColor="#0f172a"
                  bgColor="#ffffff"
                />
              ) : (
                <div className="text-slate-500 text-sm">Loading wallet address...</div>
              )}
            </div>
            
            <div className="bg-slate-800 p-4 rounded-xl flex items-center justify-between text-xs font-mono text-slate-300 mb-6">
              <span className="truncate flex-1 mr-2">{walletAddress || 'Loading...'}</span>
              <button 
                onClick={() => {
                  if (walletAddress) {
                    navigator.clipboard.writeText(walletAddress);
                    toast.success('✅ Address copied!');
                  }
                }}
                disabled={!walletAddress}
                className="px-4 py-2 rounded-lg bg-teal-500/20 text-teal-300 font-semibold hover:bg-teal-500/30 transition-colors disabled:opacity-50"
              >
                COPY
              </button>
            </div>
            
            <p className="text-xs text-slate-500">Network: Tempo Testnet • Token: USDC</p>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full relative animate-in zoom-in duration-300">
            <button 
              onClick={() => setSelectedTx(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold gradient-text mb-6">Transaction Details</h3>

            <div className="space-y-4 mb-6">
              <div className="bg-slate-800/50 p-4 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Amount</p>
                <p className="text-3xl font-bold text-teal-400">${selectedTx.amount.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">USDC</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">To</span>
                  <span className="text-slate-200 font-medium">
                    {selectedTx.recipient_name || 'Unknown'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Address</span>
                  <span className="text-slate-200 font-mono text-xs">
                    {selectedTx.recipient.slice(0, 10)}...{selectedTx.recipient.slice(-8)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">TX Hash</span>
                  <span className="text-slate-200 font-mono text-xs">
                    {selectedTx.tx_hash.slice(0, 10)}...{selectedTx.tx_hash.slice(-8)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Date</span>
                  <span className="text-slate-200 text-sm">
                    {new Date(selectedTx.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                  <span className="text-slate-400 text-sm">Status</span>
                  {getStatusBadge(selectedTx.status)}
                </div>

                {isLoadingReceipt ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    Loading blockchain confirmation...
                  </div>
                ) : txReceipt && txReceipt.confirmed && (
                  <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-green-300">Block</span>
                      <span className="text-green-200 font-mono">{txReceipt.block_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-300">Gas Used</span>
                      <span className="text-green-200 font-mono">{txReceipt.gas_used}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(selectedTx.tx_hash);
                  toast.success('✅ Transaction hash copied!');
                }}
                className="w-full glass border-slate-600 hover:border-teal-500"
              >
                📋 Copy TX Hash
              </Button>

              <Button
                onClick={() => window.open(`https://explore.tempo.xyz/tx/${selectedTx.tx_hash}`, '_blank')}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                🔗 View on Block Explorer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full relative animate-in zoom-in duration-300">
            <button 
              onClick={() => setShowAddAccountModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold gradient-text mb-6">Add New Recipient</h3>
            <p className="text-slate-400 text-sm mb-6">
              Save a name and address for faster sending
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Name / Label</label>
                <Input
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  placeholder="e.g. Mom, Savings, Friend"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Wallet Address</label>
                <Input
                  value={accountAddress}
                  onChange={e => setAccountAddress(e.target.value)}
                  placeholder="0x..."
                  className="bg-slate-800 border-slate-600 text-white font-mono"
                />
              </div>

              {addError && <p className="text-red-400 text-sm text-center">{addError}</p>}

              <Button
                onClick={handleAddAccount}
                disabled={isSubmitting || !accountName.trim() || !accountAddress.trim()}
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
              >
                {isSubmitting ? 'Saving...' : 'Save Recipient'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Accounts Modal */}
      {showViewAccountsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative animate-in zoom-in duration-300">
            <button 
              onClick={() => setShowViewAccountsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold gradient-text mb-2">Saved Recipients</h3>
            <p className="text-slate-400 text-sm mb-6">
              {savedAccounts.length} account{savedAccounts.length !== 1 ? 's' : ''} saved
            </p>

            <div className="space-y-3">
              {savedAccounts.length === 0 ? (
                <div className="text-center p-12 border border-dashed border-slate-800 rounded-2xl">
                  <div className="text-6xl mb-4">👥</div>
                  <p className="text-slate-400 mb-4">No saved recipients yet</p>
                  <Button
                    onClick={() => {
                      setShowViewAccountsModal(false);
                      setShowAddAccountModal(true);
                    }}
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
                  >
                    Add Your First Recipient
                  </Button>
                </div>
              ) : (
                savedAccounts.map((acc) => (
                  <div 
                    key={acc.id} 
                    className="p-5 rounded-2xl glass bg-slate-900/60 border border-slate-700 hover:bg-slate-800 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/30 flex items-center justify-center text-xl">
                            {acc.type === 'evm' ? '🔗' : '🏦'}
                          </div>
                          <div>
                            <p className="font-bold text-white text-lg">{acc.name}</p>
                            <p className="text-xs text-slate-500">
                              {acc.type === 'evm' ? 'EVM Wallet' : 'Bank Account'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="bg-slate-950/50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400 mb-1">Address</p>
                          <p className="text-sm text-slate-300 font-mono break-all">{acc.address}</p>
                        </div>

                        <div className="flex gap-4 mt-3 text-xs text-slate-500">
                          <span>Chain ID: {acc.chain_id}</span>
                          <span>Added: {new Date(acc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(acc.address);
                            toast.success('✅ Address copied!');
                          }}
                          className="px-3 py-2 rounded-lg bg-teal-500/20 text-teal-300 text-xs font-semibold hover:bg-teal-500/30 transition-colors"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800">
              <Button
                onClick={() => {
                  setShowViewAccountsModal(false);
                  setShowAddAccountModal(true);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600"
              >
                + Add New Recipient
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};