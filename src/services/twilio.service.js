import twilio from 'twilio';

class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    
    if (!this.accountSid || !this.authToken) {
      console.warn('⚠️ Twilio credentials not configured. SMS features will be disabled.');
      this.client = null;
      return;
    }
    
    this.client = twilio(this.accountSid, this.authToken);
  }

  /**
   * Send SMS message
   * @param {string} to - Phone number (E.164 format)
   * @param {string} message - Message content
   * @returns {Promise<object>} Twilio message response
   */
  async sendSMS(to, message) {
    if (!this.client) {
      throw new Error('Twilio client not initialized. Please configure Twilio credentials.');
    }

    try {
      console.log('📤 Sending SMS via Twilio:', { from: this.phoneNumber, to });
      
      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });

      console.log('✅ Twilio SMS sent:', { 
        sid: result.sid, 
        status: result.status, 
        to: result.to,
        dateCreated: result.dateCreated 
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        to: result.to
      };
    } catch (error) {
      console.error('Twilio SMS Error:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Send WhatsApp message
   * @param {string} to - Phone number (E.164 format)
   * @param {string} message - Message content
   * @returns {Promise<object>} Twilio message response
   */
  async sendWhatsApp(to, message) {
    if (!this.client) {
      throw new Error('Twilio client not initialized. Please configure Twilio credentials.');
    }

    try {
      const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || `whatsapp:${this.phoneNumber}`;
      const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      
      console.log('📤 Sending WhatsApp via Twilio:', { from: whatsappNumber, to: whatsappTo });
      
      const result = await this.client.messages.create({
        body: message,
        from: whatsappNumber,
        to: whatsappTo
      });

      console.log('✅ Twilio WhatsApp sent:', { 
        sid: result.sid, 
        status: result.status, 
        to: result.to,
        dateCreated: result.dateCreated 
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        to: result.to
      };
    } catch (error) {
      console.error('Twilio WhatsApp Error:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Send invitation via SMS
   * @param {string} to - Phone number
   * @param {string} patientName - Patient name
   * @param {string} code - Invitation code
   * @param {string} professionalName - Professional name
   * @param {string} customMessage - Optional custom message
   * @returns {Promise<object>}
   */
  async sendInvitationSMS(to, patientName, code, professionalName, customMessage = '') {
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const registerUrl = `${appUrl}/register/${code}`;
    
    let message = `Hola ${patientName},\n\n`;
    
    if (customMessage) {
      message += `${customMessage}\n\n`;
    }
    
    message += `${professionalName} te ha invitado a unirte a GestionTerapeutica.\n\n`;
    message += `Tu código de invitación: ${code}\n\n`;
    message += `Regístrate aquí: ${registerUrl}\n\n`;
    message += `Este código expira en 7 días.`;

    console.log('📱 Sending invitation SMS:', { to, code, messageLength: message.length });

    return await this.sendSMS(to, message);
  }

  /**
   * Send invitation via WhatsApp
   * @param {string} to - Phone number
   * @param {string} patientName - Patient name
   * @param {string} code - Invitation code
   * @param {string} professionalName - Professional name
   * @param {string} customMessage - Optional custom message
   * @returns {Promise<object>}
   */
  async sendInvitationWhatsApp(to, patientName, code, professionalName, customMessage = '') {
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const registerUrl = `${appUrl}/register/${code}`;
    
    let message = `Hola ${patientName} 👋\n\n`;
    
    if (customMessage) {
      message += `${customMessage}\n\n`;
    }
    
    message += `*${professionalName}* te ha invitado a unirte a *GestionTerapeutica*.\n\n`;
    message += `🔑 Tu código de invitación:\n*${code}*\n\n`;
    message += `📱 Regístrate aquí:\n${registerUrl}\n\n`;
    message += `⏰ Este código expira en 7 días.`;

    console.log('💬 Sending invitation WhatsApp:', { to, code, messageLength: message.length });

    return await this.sendWhatsApp(to, message);
  }

  /**
   * Send OTP using Twilio Verify
   * @param {string} to - Phone number (E.164 format)
   * @param {string} channel - 'sms' or 'call'
   * @returns {Promise<object>}
   */
  async sendOTP(to, channel = 'sms') {
    if (!this.client || !this.verifyServiceSid) {
      throw new Error('Twilio Verify service not configured.');
    }

    try {
      const verification = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications
        .create({ 
          to: to, 
          channel: channel,
          locale: 'es' // Spanish language
        });

      return {
        success: true,
        status: verification.status,
        to: verification.to,
        channel: verification.channel
      };
    } catch (error) {
      console.error('Twilio Verify Send OTP Error:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Verify OTP code
   * @param {string} to - Phone number (E.164 format)
   * @param {string} code - OTP code
   * @returns {Promise<object>}
   */
  async verifyOTP(to, code) {
    if (!this.client || !this.verifyServiceSid) {
      throw new Error('Twilio Verify service not configured.');
    }

    try {
      const verificationCheck = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks
        .create({ 
          to: to, 
          code: code 
        });

      return {
        success: verificationCheck.status === 'approved',
        status: verificationCheck.status,
        valid: verificationCheck.valid
      };
    } catch (error) {
      console.error('Twilio Verify Check OTP Error:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Format phone number to E.164 format
   * @param {string} phone - Phone number
   * @param {string} countryCode - Default country code (e.g., '52' for Mexico)
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phone, countryCode = '52') {
    // If already in E.164 format (starts with +), return as is
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If it's a 10-digit number, add country code
    if (cleaned.length === 10) {
      cleaned = countryCode + cleaned;
    }
    
    // Add + prefix
    return '+' + cleaned;
  }

  /**
   * Check if Twilio is configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.client !== null;
  }
}

export default new TwilioService();
