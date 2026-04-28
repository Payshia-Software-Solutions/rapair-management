import { EmailBlock } from "./constants";

export const compileEmailHtml = (blocks: EmailBlock[], options: { canvasBgColor?: string, contentBgColor?: string, includeUnsubscribe?: boolean, includeViewInBrowser?: boolean, permissionReminderText?: string } = {}) => {
  const { canvasBgColor = "#f4f4f7", contentBgColor = "#ffffff", includeUnsubscribe = true, includeViewInBrowser = false, permissionReminderText = "" } = options;

  let html = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Newsletter</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${canvasBgColor}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${canvasBgColor};">
      <tr>
        <td align="center" style="padding: 40px 0;">
          ${includeViewInBrowser ? `
          <div style="max-width: 600px; margin: 0 auto 20px auto; text-align: center; font-family: sans-serif; font-size: 11px;">
            <a href="{{view_in_browser_url}}" style="color: #666666; text-decoration: underline;">View this email in your browser</a>
          </div>
          ` : ''}
          <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: ${contentBgColor}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 600px; width: 100%;">
            <tr>
              <td>
  `;

  blocks.forEach(block => {
    const bg = block.content.backgroundColor ? `background-color: ${block.content.backgroundColor};` : '';
    const align = block.content.textAlign || 'center';
    
    switch(block.type) {
      case 'hero':
        html += `
        <div style="${bg} padding: 60px 40px; text-align: ${align};">
          <h1 style="color: ${block.content.titleColor || '#000000'}; font-family: sans-serif; margin: 0; font-size: 32px; letter-spacing: -1px; text-transform: uppercase;">${block.content.title}</h1>
          <p style="color: ${block.content.subtitleColor || '#666666'}; font-family: sans-serif; margin-top: 10px; font-size: 14px;">${block.content.subtitle}</p>
        </div>`;
        break;
      case 'text':
        html += `<div style="${bg} color: ${block.content.textColor || '#555555'}; font-family: sans-serif; padding: 20px 40px; line-height: 1.6; font-size: 16px; text-align: ${align};">${block.content.text}</div>`;
        break;
      case 'image': {
        const imgHtml = `<img src="${block.content.url}" style="width: 100%; border-radius: 12px; display: block;" />`;
        if (block.content.linkUrl) {
          html += `<div style="${bg} padding: 20px 40px;"><a href="${block.content.linkUrl}" style="text-decoration: none; display: block;">${imgHtml}</a></div>`;
        } else {
          html += `<div style="${bg} padding: 20px 40px;">${imgHtml}</div>`;
        }
        break;
      }
      case 'button':
        html += `
        <div style="${bg} text-align: center; padding: 20px;">
          <a href="${block.content.url}" style="background: ${block.content.buttonBgColor || '#000000'}; color: ${block.content.buttonTextColor || '#ffffff'}; font-family: sans-serif; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; text-transform: uppercase; display: inline-block;">${block.content.label}</a>
        </div>`;
        break;
      case 'divider':
        html += `<div style="${bg} padding: 20px 40px;"><hr style="border: none; border-top: 1px solid #eeeeee;" /></div>`;
        break;
      case 'social':
        html += `
        <div style="${bg} text-align: center; padding: 30px;">
          ${block.content.facebook ? `<a href="${block.content.facebook}" style="display: inline-block; margin: 0 10px; text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/32/733/733547.png" width="24" height="24" style="display: block; border: 0;" alt="Facebook" /></a>` : ''}
          ${block.content.instagram ? `<a href="${block.content.instagram}" style="display: inline-block; margin: 0 10px; text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/32/2111/2111463.png" width="24" height="24" style="display: block; border: 0;" alt="Instagram" /></a>` : ''}
          ${block.content.twitter ? `<a href="${block.content.twitter}" style="display: inline-block; margin: 0 10px; text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/32/733/733579.png" width="24" height="24" style="display: block; border: 0;" alt="Twitter" /></a>` : ''}
        </div>`;
        break;
      case 'services':
        html += `<div style="${bg} padding: 20px 40px; text-align: center;">`;
        block.content.items?.forEach((item: string) => {
          html += `<div style="display: inline-block; margin: 5px; padding: 10px 20px; background: #f8f9fa; border-radius: 8px; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #333333;">${item}</div>`;
        });
        html += `</div>`;
        break;
      case 'image-grid': {
        const { rows, columns, items } = block.content;
        html += `<div style="padding: 20px 40px;">`;
        html += `<table width="100%" border="0" cellspacing="0" cellpadding="0">`;
        for (let r = 0; r < rows; r++) {
          html += `<tr>`;
          for (let c = 0; c < columns; c++) {
            const item = items[r * columns + c] || { url: 'https://placehold.co/400', linkText: '', linkUrl: '#' };
            html += `<td width="${100/columns}%" style="padding: 10px; vertical-align: top; text-align: center;">`;
            const imgTag = `<img src="${item.url}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; display: block; margin-bottom: 8px;" />`;
            if (item.linkUrl) {
              html += `<a href="${item.linkUrl}" style="text-decoration: none; display: block;">${imgTag}</a>`;
            } else {
              html += imgTag;
            }
            if (item.linkText) {
              html += `<a href="${item.linkUrl || '#'}" style="color: #000000; font-size: 12px; font-weight: bold; text-decoration: none; text-transform: uppercase;">${item.linkText}</a>`;
            }
            html += `</td>`;
          }
          html += `</tr>`;
        }
        html += `</table></div>`;
        break;
      }
    }
  });

  html += `
              </td>
            </tr>
          </table>
          ${includeUnsubscribe ? `
          <div style="padding: 40px; text-align: center; font-family: sans-serif; font-size: 12px; color: #999999;">
            ${permissionReminderText ? `<p style="margin: 0 0 15px 0;">${permissionReminderText}</p>` : ''}
            <p style="margin: 0;">&copy; 2026 Payshia Software Solutions. All rights reserved.</p>
            <p style="margin: 10px 0 0 0;">
              <a href="{{unsubscribe_url}}" style="color: #999999; text-decoration: underline;">Unsubscribe from this list</a>
            </p>
          </div>
          ` : ''}
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  return html;
};
