// // services/paystackService.js
// const axios = require('axios');
// const crypto = require('crypto');

// class PaystackService {
//   constructor() {
//     this.baseURL = 'https://api.paystack.co';
//     this.secretKey = process.env.PAYSTACK_SECRET_KEY;
//     this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
//   }

//   // 🔑 Helper: Default headers
//   getHeaders() {
//     return {
//       Authorization: `Bearer ${this.secretKey}`,
//       'Content-Type': 'application/json',
//     };
//   }

//   // 🔑 Helper: Consistent API response
//   handleResponse(response) {
//     return {
//       success: true,
//       message: 'Request successful',
//       data: response.data,
//     };
//   }

//   handleError(error, fallbackMessage) {
//     return {
//       success: false,
//       message: error.response?.data?.message || fallbackMessage,
//       details: error.response?.data || error.message,
//     };
//   }

//   // 💳 Initialize payment
//   async initializeTransaction(data) {
//     try {
//       const response = await axios.post(
//         `${this.baseURL}/transaction/initialize`,
//         {
//           email: data.email,
//           amount: data.amount * 100, // Convert to kobo
//           reference: data.reference,
//           callback_url: data.callback_url,
//           metadata: data.metadata,
//         },
//         { headers: this.getHeaders() }
//       );
//       return this.handleResponse(response);
//     } catch (error) {
//       return this.handleError(error, 'Payment initialization failed');
//     }
//   }

//   async resolveAccount(accountNumber, bankCode) {
//     try {
//       const response = await axios.get(
//         `${this.baseURL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
//         { headers: this.getHeaders() }
//       );

//       if (response.data.status) {
//         return { success: true, accountName: response.data.data.account_name };
//       } else {
//         return { success: false, message: 'Failed to resolve account' };
//       }
//     } catch (error) {
//       return this.handleError(error, 'Account resolution failed');
//     }
//   }

//   // ✅ Verify payment
//   async verifyTransaction(reference) {
//     try {
//       const response = await axios.get(
//         `${this.baseURL}/transaction/verify/${reference}`,
//         { headers: this.getHeaders() }
//       );
//       return this.handleResponse(response);
//     } catch (error) {
//       return this.handleError(error, 'Payment verification failed');
//     }
//   }

//   // 👤 Create customer
//   async createCustomer(data) {
//     try {
//       const response = await axios.post(
//         `${this.baseURL}/customer`,
//         {
//           email: data.email,
//           first_name: data.firstName,
//           last_name: data.lastName,
//           phone: data.phone,
//         },
//         { headers: this.getHeaders() }
//       );
//       return this.handleResponse(response);
//     } catch (error) {
//       return this.handleError(error, 'Customer creation failed');
//     }
//   }

//   // 🏦 Create transfer recipient
//   async createTransferRecipient(data) {
//     try {
//       const response = await axios.post(
//         `${this.baseURL}/transferrecipient`,
//         {
//           type: 'nuban',
//           name: data.name,
//           account_number: data.accountNumber,
//           bank_code: data.bankCode,
//           currency: 'NGN',
//         },
//         { headers: this.getHeaders() }
//       );
//       return this.handleResponse(response);
//     } catch (error) {
//       return this.handleError(error, 'Transfer recipient creation failed');
//     }
//   }

//   // 💸 Initiate transfer
//   async initiateTransfer(data) {
//     try {
//       const response = await axios.post(
//         `${this.baseURL}/transfer`,
//         {
//           source: 'balance',
//           amount: data.amount * 100, // Convert to kobo
//           recipient: data.recipientCode,
//           reason: data.reason,
//         },
//         { headers: this.getHeaders() }
//       );
//       return this.handleResponse(response);
//     } catch (error) {
//       return this.handleError(error, 'Transfer initiation failed');
//     }
//   }

//   // 🏦 Get all banks (extra utility)
//   async getBanks() {
//     try {
//       const response = await axios.get(`${this.baseURL}/bank`, {
//         headers: this.getHeaders(),
//       });
//       return this.handleResponse(response);
//     } catch (error) {
//       return this.handleError(error, 'Failed to fetch banks');
//     }
//   }

//   // 💰 Get balance (extra utility)
//   async getBalance() {
//     try {
//       const response = await axios.get(`${this.baseURL}/balance`, {
//         headers: this.getHeaders(),
//       });
//       return this.handleResponse(response);
//     } catch (error) {
//       return this.handleError(error, 'Failed to fetch balance');
//     }
//   }

//   // 🔑 Secure unique reference generator
//   generateReference() {
//     return `EDU_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
//   }
// }

// module.exports = new PaystackService();



// services/paystackService.js
const axios = require('axios');
const crypto = require('crypto');

class PaystackService {
  constructor() {
    this.baseURL = 'https://api.paystack.co';
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
  }

  // 🔑 Helper: Default headers
  getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  // 🔑 Helper: Consistent API response
  handleResponse(response) {
    return {
      success: true,
      message: 'Request successful',
      data: response.data, // This is the Paystack response
    };
  }

  handleError(error, fallbackMessage) {
    console.error('Paystack error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    return {
      success: false,
      message: error.response?.data?.message || fallbackMessage,
      details: error.response?.data || error.message,
    };
  }

  // 💳 Initialize payment
  async initializeTransaction(data) {
    try {
      const response = await axios.post(
        `${this.baseURL}/transaction/initialize`,
        {
          email: data.email,
          amount: data.amount * 100, // Convert to kobo
          reference: data.reference,
          callback_url: data.callback_url,
          metadata: data.metadata,
        },
        { headers: this.getHeaders() }
      );
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, 'Payment initialization failed');
    }
  }

  async resolveAccount(accountNumber, bankCode) {
    try {
      const response = await axios.get(
        `${this.baseURL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        { headers: this.getHeaders() }
      );

      if (response.data.status) {
        return { success: true, accountName: response.data.data.account_name };
      } else {
        return { success: false, message: 'Failed to resolve account' };
      }
    } catch (error) {
      return this.handleError(error, 'Account resolution failed');
    }
  }

  // ✅ Verify payment
  async verifyTransaction(reference) {
    try {
      const response = await axios.get(
        `${this.baseURL}/transaction/verify/${reference}`,
        { headers: this.getHeaders() }
      );
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, 'Payment verification failed');
    }
  }

  // 👤 Create customer
  async createCustomer(data) {
    try {
      const response = await axios.post(
        `${this.baseURL}/customer`,
        {
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
        },
        { headers: this.getHeaders() }
      );
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, 'Customer creation failed');
    }
  }

  // 🏦 Create transfer recipient - FIXED VERSION
  async createTransferRecipient(data) {
    try {
      console.log('Creating transfer recipient with data:', data);
      
      // Validate required fields
      if (!data.bankCode) {
        throw new Error('Bank code is required');
      }
      if (!data.accountNumber) {
        throw new Error('Account number is required');
      }
      if (!data.name) {
        throw new Error('Account name is required');
      }

      const response = await axios.post(
        `${this.baseURL}/transferrecipient`,
        {
          type: 'nuban',
          name: data.name,
          account_number: data.accountNumber,
          bank_code: data.bankCode,
          currency: 'NGN',
        },
        { headers: this.getHeaders() }
      );

      console.log('Paystack recipient response:', response.data);

      // Return the actual data from Paystack
      if (response.data.status) {
        return {
          success: true,
          message: 'Recipient created successfully',
          data: response.data.data, // This contains recipient_code
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Failed to create recipient',
          data: null,
        };
      }
    } catch (error) {
      console.error('Paystack create recipient error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      return {
        success: false,
        message: error.response?.data?.message || 'Transfer recipient creation failed',
        data: null,
      };
    }
  }

  // 💸 Initiate transfer - FIXED VERSION
  async initiateTransfer(data) {
    try {
      console.log('Initiating transfer with data:', data);
      
      // Validate required fields
      if (!data.recipientCode) {
        throw new Error('Recipient code is required');
      }
      if (!data.amount || data.amount <= 0) {
        throw new Error('Valid amount is required');
      }

      const response = await axios.post(
        `${this.baseURL}/transfer`,
        {
          source: 'balance',
          amount: data.amount * 100, // Convert to kobo
          recipient: data.recipientCode,
          reason: data.reason || 'Wallet withdrawal',
        },
        { headers: this.getHeaders() }
      );

      console.log('Paystack transfer response:', response.data);

      // Return the actual data from Paystack
      if (response.data.status) {
        return {
          success: true,
          message: 'Transfer initiated successfully',
          data: response.data.data, // This contains transfer details
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Failed to initiate transfer',
          data: null,
        };
      }
    } catch (error) {
      console.error('Paystack transfer error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      return {
        success: false,
        message: error.response?.data?.message || 'Transfer initiation failed',
        data: null,
      };
    }
  }

  // 🏦 Get all banks (extra utility)
  async getBanks() {
    try {
      const response = await axios.get(`${this.baseURL}/bank`, {
        headers: this.getHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, 'Failed to fetch banks');
    }
  }

  // 💰 Get balance (extra utility)
  async getBalance() {
    try {
      const response = await axios.get(`${this.baseURL}/balance`, {
        headers: this.getHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error, 'Failed to fetch balance');
    }
  }

  // 🔑 Secure unique reference generator
  generateReference() {
    return `EDU_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
}

module.exports = new PaystackService();