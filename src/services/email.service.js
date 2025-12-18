import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'nodemailer'; // 'nodemailer' or 'sendgrid'
    
    if (this.provider === 'sendgrid') {
      this.initSendGrid();
    } else {
      this.initNodemailer();
    }
  }

  /**
   * Initialize SendGrid
   */
  initSendGrid() {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ SendGrid API key not configured. Email features will be disabled.');
      this.sendGridConfigured = false;
      return;
    }
    
    sgMail.setApiKey(apiKey);
    this.sendGridConfigured = true;
    console.log('✅ SendGrid configured');
  }

  /**
   * Initialize Nodemailer (Gmail or custom SMTP)
   */
  initNodemailer() {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT || 587;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;
    
    if (!host || !user || !pass) {
      console.warn('⚠️ Email credentials not configured. Email features will be disabled.');
      this.transporter = null;
      return;
    }
    
    this.transporter = nodemailer.createTransport({
      host: host,
      port: parseInt(port),
      secure: port == 465, // true for 465, false for other ports
      auth: {
        user: user,
        pass: pass
      }
    });
    
    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email configuration error:', error);
      } else {
        console.log('✅ Email server ready');
      }
    });
  }

  /**
   * Send email using configured provider
   * @param {object} options - Email options
   * @returns {Promise<object>}
   */
  async sendEmail({ to, subject, html, text }) {
    const from = process.env.EMAIL_FROM || 'noreply@gestionterapeutica.com';
    
    try {
      if (this.provider === 'sendgrid' && this.sendGridConfigured) {
        return await this.sendWithSendGrid({ to, from, subject, html, text });
      } else if (this.transporter) {
        return await this.sendWithNodemailer({ to, from, subject, html, text });
      } else {
        throw new Error('No email service configured');
      }
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send email with SendGrid
   */
  async sendWithSendGrid({ to, from, subject, html, text }) {
    const msg = {
      to,
      from,
      subject,
      text: text || '',
      html: html || text
    };

    const response = await sgMail.send(msg);
    
    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
      provider: 'sendgrid'
    };
  }

  /**
   * Send email with Nodemailer
   */
  async sendWithNodemailer({ to, from, subject, html, text }) {
    const info = await this.transporter.sendMail({
      from,
      to,
      subject,
      text: text || '',
      html: html || text
    });

    return {
      success: true,
      messageId: info.messageId,
      provider: 'nodemailer'
    };
  }

  /**
   * Send invitation email
   * @param {string} to - Recipient email
   * @param {string} patientName - Patient name
   * @param {string} code - Invitation code
   * @param {string} professionalName - Professional name
   * @param {string} customMessage - Optional custom message
   * @returns {Promise<object>}
   */
  async sendInvitationEmail(to, patientName, code, professionalName, customMessage = '') {
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const registerUrl = `${appUrl}/register/${code}`;
    
    const subject = `Invitación a GestionTerapeutica de ${professionalName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #4F46E5;
          }
          .content {
            margin-bottom: 30px;
          }
          .code-box {
            background-color: #F3F4F6;
            border: 2px dashed #D1D5DB;
            border-radius: 6px;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
          }
          .code {
            font-size: 32px;
            font-weight: bold;
            color: #4F46E5;
            letter-spacing: 4px;
          }
          .button {
            display: inline-block;
            background-color: #4F46E5;
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
          }
          .button:hover {
            background-color: #4338CA;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #E5E7EB;
            font-size: 14px;
            color: #6B7280;
            text-align: center;
          }
          .custom-message {
            background-color: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏥 GestionTerapeutica</div>
          </div>
          
          <div class="content">
            <h2>Hola ${patientName},</h2>
            
            ${customMessage ? `
              <div class="custom-message">
                <strong>Mensaje de ${professionalName}:</strong><br>
                ${customMessage}
              </div>
            ` : ''}
            
            <p><strong>${professionalName}</strong> te ha invitado a unirte a GestionTerapeutica, una plataforma para gestionar tu proceso terapéutico de manera segura y eficiente.</p>
            
            <p>Para completar tu registro, usa el siguiente código de invitación:</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <p style="text-align: center;">
              <a href="${registerUrl}" class="button">Registrarme Ahora</a>
            </p>
            
            <p style="font-size: 14px; color: #6B7280;">
              O copia y pega este enlace en tu navegador:<br>
              <a href="${registerUrl}" style="color: #4F46E5;">${registerUrl}</a>
            </p>
          </div>
          
          <div class="footer">
            <p>Este código expira en 7 días.</p>
            <p>Si no solicitaste esta invitación, puedes ignorar este correo.</p>
            <p>&copy; 2025 GestionTerapeutica. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Hola ${patientName},

${customMessage ? `Mensaje de ${professionalName}:\n${customMessage}\n\n` : ''}

${professionalName} te ha invitado a unirte a GestionTerapeutica.

Tu código de invitación: ${code}

Regístrate aquí: ${registerUrl}

Este código expira en 7 días.

Si no solicitaste esta invitación, puedes ignorar este correo.
    `.trim();
    
    return await this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send welcome email after registration
   * @param {string} to - Recipient email
   * @param {string} name - User name
   * @returns {Promise<object>}
   */
  async sendWelcomeEmail(to, name) {
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    
    const subject = '¡Bienvenido a GestionTerapeutica!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            color: #4F46E5;
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            background-color: #4F46E5;
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🏥 GestionTerapeutica</div>
          <h2>¡Bienvenido, ${name}!</h2>
          <p>Tu cuenta ha sido creada exitosamente.</p>
          <p>Ahora puedes acceder a la plataforma y comenzar tu proceso terapéutico.</p>
          <p style="text-align: center; margin-top: 30px;">
            <a href="${appUrl}/login" class="button">Iniciar Sesión</a>
          </p>
        </div>
      </body>
      </html>
    `;
    
    return await this.sendEmail({ to, subject, html });
  }

  /**
   * Check if email service is configured
   * @returns {boolean}
   */
  isConfigured() {
    if (this.provider === 'sendgrid') {
      return this.sendGridConfigured;
    }
    return this.transporter !== null;
  }
}

export default new EmailService();
