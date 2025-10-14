import nodemailer from 'nodemailer';
import {google} from 'googleapis';
const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
  process.env.MAILER_CLIENT_ID,
  process.env.MAILER_CLIENT_SECRET,
);
oauth2Client.setCredentials({
  refresh_token:process.env.MAILER_REFRESH_TOKEN
});
const sendMail = async(to,message) => {
  const accessToken = await oauth2Client.getAccessToken();
  const transporter = nodemailer.createTransport({
    service:process.env.MAILER_SERVICE,
    auth:{
      type: 'OAuth2',
      user:process.env.MAILER_MAIL,
      clientId:process.env.MAILER_CLIENT_ID,
      clientSecret:process.env.MAILER_CLIENT_SECRET,
      refreshToken:process.env.MAILER_REFRESH_TOKEN,
      accessToken:accessToken
    }
  });//Bu kısımda mailer servisine ait bilgileri yazıyoruz.

  const mailerOptions = {
    from:`Scriber <${process.env.MAILER_MAIL}>`,
    to:to,
    subject:message.subject,
    html:message.html
  };
  
  transporter.sendMail(mailerOptions,(err,info) => {
    if(err){
      console.log(err);
    }
    transporter.close();
  });
}





export default sendMail;