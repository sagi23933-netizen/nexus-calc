/** SMTP sockets are not available in this runtime — email goes through the Resend API instead. */
function createTransport() {
  const fail = async () => {
    throw new Error('SMTP אינו נתמך בשרת Cloudflare — בחרו ספק Resend בהגדרות האימייל');
  };
  return { sendMail: fail, verify: fail };
}
export default { createTransport };
