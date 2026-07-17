import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Site'
const SITE_LOGO = process.env.NEXT_PUBLIC_SITE_LOGO || '/logo.webp'
const LOGO_URL = SITE_LOGO.startsWith('http') ? SITE_LOGO : `${APP_URL}${SITE_LOGO}`

// ============================================================
// 🎨 ORTAK E-POSTA ŞABLONU - "kazino fişi" temasıyla, sitenin koyu/altın
// paletine uygun. Tablo tabanlı yapı kullanıyoruz (flexbox/grid DEĞİL) çünkü
// Outlook gibi e-posta istemcileri modern CSS'i düzgün desteklemiyor - bu,
// e-posta HTML'i yazarken standart, güvenli bir pratik.
// ============================================================
function buildEmailHtml({
  preheader,
  badgeEmoji,
  heading,
  greeting,
  bodyLines,
  ctaLabel,
  ctaUrl,
  footerNote,
}: {
  preheader: string
  badgeEmoji: string
  heading: string
  greeting: string
  bodyLines: string[]
  ctaLabel: string
  ctaUrl: string
  footerNote: string
}) {
  return `
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>${SITE_NAME}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#0B1120; font-family: Arial, Helvetica, sans-serif;">
    <!-- Gmail/Outlook önizleme metni - görünmez -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B1120; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">

            <!-- Logo -->
            <tr>
              <td align="center" style="padding-bottom: 24px;">
                <img src="${LOGO_URL}" alt="${SITE_NAME}" width="72" height="72" style="display:block; width: 72px; height: auto; border-radius: 16px;" />
              </td>
            </tr>

            <!-- Ana kart - altın çerçeveli, koyu panel -->
            <tr>
              <td style="border-radius: 20px; padding: 2px; background: linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B); background-color: #F59E0B;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#111A2E; border-radius: 18px;">

                  <!-- Fiş rozeti + başlık -->
                  <tr>
                    <td align="center" style="padding: 40px 32px 8px;">
                      <div style="display:inline-block; width:56px; height:56px; line-height:56px; border-radius:50%; background-color:#F59E0B; font-size:26px; text-align:center; box-shadow: 0 4px 14px rgba(245,158,11,0.4);">
                        ${badgeEmoji}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 12px 32px 0;">
                      <h1 style="margin:0; color:#F1F5F9; font-size:22px; font-weight:800; font-family: Arial, Helvetica, sans-serif;">${heading}</h1>
                    </td>
                  </tr>

                  <!-- İçerik -->
                  <tr>
                    <td style="padding: 20px 36px 8px; color:#CBD5E1; font-size:15px; line-height:1.7;">
                      <p style="margin:0 0 14px; color:#F1F5F9;">${greeting}</p>
                      ${bodyLines.map((line) => `<p style="margin:0 0 14px;">${line}</p>`).join('\n                      ')}
                    </td>
                  </tr>

                  <!-- CTA Butonu -->
                  <tr>
                    <td align="center" style="padding: 12px 32px 28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="border-radius: 12px; background-color:#F59E0B; background: linear-gradient(135deg, #F59E0B, #D97706);">
                            <a href="${ctaUrl}" target="_blank" style="display:inline-block; padding: 15px 42px; color:#0B1120; font-size:15px; font-weight:800; text-decoration:none; font-family: Arial, Helvetica, sans-serif;">
                              ${ctaLabel}
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Yedek link -->
                  <tr>
                    <td style="padding: 0 32px 28px;">
                      <p style="margin:0 0 8px; color:#64748B; font-size:12px;">Buton çalışmazsa bu linki tarayıcınıza kopyalayın:</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B1120; border-radius: 8px; border: 1px solid #232E4A;">
                        <tr>
                          <td style="padding: 10px 12px; word-break: break-all; color:#94A3B8; font-size:12px; font-family: monospace;">
                            ${ctaUrl}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Ayraç -->
                  <tr>
                    <td style="padding: 0 32px;">
                      <div style="height:1px; background-color:#232E4A;"></div>
                    </td>
                  </tr>

                  <!-- Alt not -->
                  <tr>
                    <td style="padding: 18px 32px 32px;">
                      <p style="margin:0; color:#64748B; font-size:12px; line-height:1.6;">${footerNote}</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>

            <!-- Dış footer -->
            <tr>
              <td align="center" style="padding: 24px 16px 8px;">
                <p style="margin:0; color:#475569; font-size:12px;">© ${new Date().getFullYear()} ${SITE_NAME}. Tüm hakları saklıdır.</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `
}

/**
 * Email doğrulama maili gönder
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  username?: string
) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${SITE_NAME} - Email Doğrulama`,
      html: buildEmailHtml({
        preheader: `${SITE_NAME} hesabınızı doğrulamak için tek bir tık kaldı.`,
        badgeEmoji: '✉️',
        heading: 'Email Doğrulama',
        greeting: `Merhaba${username ? ` <strong>${username}</strong>` : ''},`,
        bodyLines: [
          `${SITE_NAME} hesabınızı oluşturduğunuz için teşekkür ederiz! 🎉`,
          'Email adresinizi doğrulamak için aşağıdaki butona tıklayın:',
        ],
        ctaLabel: 'Email Doğrula',
        ctaUrl: verifyUrl,
        footerNote: 'Bu link 24 saat içinde geçerliliğini yitirecektir.<br>Eğer bu hesabı siz oluşturmadıysanız, bu e-postayı görmezden gelebilirsiniz.',
      }),
    })

    console.log('✅ Verification email sent to:', email)
    return true
  } catch (error) {
    console.error('❌ Error sending verification email:', error)
    return false
  }
}

/**
 * 6 haneli doğrulama kodu maili gönder (buton yerine büyük kod gösterimi)
 */
export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  username?: string
) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${SITE_NAME} - Doğrulama Kodu`,
      html: `
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>${SITE_NAME}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#0B1120; font-family: Arial, Helvetica, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">Doğrulama kodunuz: ${code}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B1120; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">
            <tr>
              <td align="center" style="padding-bottom: 24px;">
                <img src="${LOGO_URL}" alt="${SITE_NAME}" width="72" height="72" style="display:block; width: 72px; height: auto; border-radius: 16px;" />
              </td>
            </tr>
            <tr>
              <td style="border-radius: 20px; padding: 2px; background: linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B); background-color: #F59E0B;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#111A2E; border-radius: 18px;">
                  <tr>
                    <td align="center" style="padding: 40px 32px 8px;">
                      <div style="display:inline-block; width:56px; height:56px; line-height:56px; border-radius:50%; background-color:#F59E0B; font-size:26px; text-align:center; box-shadow: 0 4px 14px rgba(245,158,11,0.4);">
                        🔢
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 12px 32px 0;">
                      <h1 style="margin:0; color:#F1F5F9; font-size:22px; font-weight:800;">Doğrulama Kodu</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 36px 8px; color:#CBD5E1; font-size:15px; line-height:1.7;">
                      <p style="margin:0 0 14px; color:#F1F5F9;">Merhaba${username ? ` <strong>${username}</strong>` : ''},</p>
                      <p style="margin:0 0 14px;">Email adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 8px 32px 28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#0B1120; border: 1px solid #F59E0B40; border-radius: 14px;">
                        <tr>
                          <td style="padding: 20px 40px;">
                            <span style="color:#FBBF24; font-size:36px; font-weight:800; letter-spacing: 10px; font-family: monospace;">${code}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 32px;">
                      <div style="height:1px; background-color:#232E4A;"></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 18px 32px 32px;">
                      <p style="margin:0; color:#64748B; font-size:12px; line-height:1.6;">Bu kod 10 dakika boyunca geçerlidir.<br>Bu kodu siz talep etmediyseniz, bu e-postayı görmezden gelebilirsiniz.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 24px 16px 8px;">
                <p style="margin:0; color:#475569; font-size:12px;">© ${new Date().getFullYear()} ${SITE_NAME}. Tüm hakları saklıdır.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
      `,
    })

    console.log('✅ Verification code email sent to:', email)
    return true
  } catch (error) {
    console.error('❌ Error sending verification code email:', error)
    return false
  }
}

/**
 * Şifre sıfırlama maili gönder
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  username?: string
) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${SITE_NAME} - Şifre Sıfırlama`,
      html: buildEmailHtml({
        preheader: `${SITE_NAME} şifrenizi sıfırlamak için buradan devam edin.`,
        badgeEmoji: '🔐',
        heading: 'Şifre Sıfırlama',
        greeting: `Merhaba${username ? ` <strong>${username}</strong>` : ''},`,
        bodyLines: [
          'Şifrenizi sıfırlamak için bir talepte bulundunuz.',
          'Yeni bir şifre belirlemek için aşağıdaki butona tıklayın:',
        ],
        ctaLabel: 'Şifreyi Sıfırla',
        ctaUrl: resetUrl,
        footerNote: 'Bu link 1 saat içinde geçerliliğini yitirecektir.<br>Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz - şifreniz değişmeyecektir.',
      }),
    })

    console.log('✅ Password reset email sent to:', email)
    return true
  } catch (error) {
    console.error('❌ Error sending password reset email:', error)
    return false
  }
}
