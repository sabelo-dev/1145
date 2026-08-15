
interface PayFastPaymentData {
  amount: number;
  itemName: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
}

interface PayFastResponse {
  success: boolean;
  redirectUrl?: string;
  error?: string;
}

export const createPayFastPayment = async (data: PayFastPaymentData): Promise<PayFastResponse> => {
  try {
    // PayFast configuration - these should be set as environment variables in production
    // For now, using test credentials but they should be moved to Supabase secrets
    const merchantId = "10000100"; // TODO: Move to Supabase secrets
    const merchantKey = "46f0cd694581a"; // TODO: Move to Supabase secrets  
    const passphrase = "jt7NOE43FZPn"; // TODO: Move to Supabase secrets
    
    // Create payment form data
    const paymentData = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: data.returnUrl,
      cancel_url: data.cancelUrl,
      notify_url: data.notifyUrl,
      name_first: data.customerFirstName,
      name_last: data.customerLastName,
      email_address: data.customerEmail,
      m_payment_id: `SIM-${Date.now()}`, // Unique payment ID
      amount: data.amount.toFixed(2),
      item_name: data.itemName,
      item_description: data.itemName,
      email_confirmation: 1,
      confirmation_address: data.customerEmail,
    };

    // Generate signature (in production, this should be done server-side)
    const signature = generatePayFastSignature(paymentData, passphrase);
    
    // Create form and redirect to PayFast
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://payfast.co.za/eng/process'; 
    form.style.display = 'none';

    // Add all payment data as hidden inputs
    Object.entries({ ...paymentData, signature }).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value.toString();
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    return {
      success: true,
      redirectUrl: 'https://payfast.co.za/eng/process',
    };
  } catch (error) {
    console.error('PayFast payment creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment creation failed',
    };
  }
};

const generatePayFastSignature = (data: Record<string, any>, passphrase: string): string => {
  const filteredData = Object.keys(data)
    .filter((key) => key !== 'signature' && data[key] !== '' && data[key] !== null && data[key] !== undefined)
    .sort()
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {} as Record<string, any>);

  const paramString = Object.keys(filteredData)
    .map((key) => `${key}=${encodeURIComponent(String(filteredData[key]).trim()).replace(/%20/g, '+').replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase())}`)
    .join('&');

  const stringToHash = `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+').replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase())}`;

  return btoa(stringToHash).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
};
