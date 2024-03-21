const mysql = require("mysql2");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const database = require("../routes/db-config");
const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const Signup = require("./Signup");
const Login = require("./Login");
const nodemailer = require("nodemailer");


const database = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE

});




exports.Signup = (req,res)=>{
    console.log(req.body);
    const {FirstName, LastName, Email, Password, Phone} = req.body;

    database.query(`insert into user (firstN , lastN, uEmail, uPassword, uPhone ) values (?, ?, ?, ?, ?)`, [FirstName , LastName, Email, Password, Phone], (err, results) => {
        if (err){
            console.log(err);
        } else {
            res.send("Form submitted");
        }

    })
    
}

exports.Login= (req,res)=>{
    console.log(req.body);
    const {Email, Password} = req.body;

    database.query(`SELECT * FROM user WHERE uEmail = ? AND uPassword = ?`, [Email, Password], (err, results) => {
        if (err){
            console.log(err);
        } 

        if (results.length === 1) {
            res.send("Login successful"); 
        } else {
            res.status(401).send("Wrong Email or Password");
        }

    });
    
}

exports.ForgotPassword= (Email)=>{
    database.query('SELECT * FROM user WHERE uEmail = ? ', [Email] , (err, results) => {
        if (err) {
            console.log(err);
        }

        // Check if a user with the given email exists
        if (results.length > 0) {
            // If a user with the given email exists, log the first result
            //console.log(results[0]);
            res.send("Email Sent")
        } else {
            // If no user with the given email exists, handle it appropriately
            res.send("No user found with the provided email");
        }
    });

  
// SQL queries used for password reset
const q = "SELECT * FROM user WHERE uEmail = ?";
const w = "DELETE FROM password_resets WHERE uEmail = ?";
const e = "INSERT INTO password_resets (uEmail, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))";
const t = "SELECT * FROM password_resets WHERE uEmail = ? AND token = ? AND expires_at > NOW()";
const r = "UPDATE user SET uPassword = ? WHERE uEmail = ?";


// Forgotten password handler
   exports.HandleforgottenPassword = asyncHandler(async (req, res) => {
    const email = req.body.email;
    console.log('uEmail:', email);
  
    database.query(q , [email], async (error, results) => {
      if (error) {
        console.error('Database query error:', error);
        res.status(500).send('error occurred');
      } else if (results.length > 0) {
        const resetToken = crypto.randomBytes(20).toString('hex');
        const hash = await bcrypt.hash(resetToken, 10);
  
        const deleteExistingTokens = w;
        database.query(deleteExistingTokens, [email], (error, results) => {
          if (error) console.log(error);
        });
  
        const insertToken = e;
        console.log('Hashed token:', hash);
        database.query(insertToken, [email, hash], (error, results) => {
          if (error) {
            console.log(error);
            res.status(500).send('An error occurred with token generation');
          } else {
            const transporter = nodemailer.createTransport({
              host: 'smtp.gmail.com', //for gmail
              port: 465,
              secure: true,
              auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD
              }
            });
            //body of the gmail
          
          const mailOptions = { 
            from: process.env.EMAIL,
            to: email,
            subject: 'Password Reset',
            html: `<p>Hello ${email}, It has come to our attention that you would like to reset your password. </p><p>Please follow the link provided <a href="http://localhost:8080/Public/ResetPassword.html?token=${resetToken}&email=${email}">here</a> to reset your password now.</p>`
          };
              
              //Here the email will be sent if its in the database.
            transporter.sendMail(mailOptions, (error, info) => {
              if (error) { 
                console.error("Error sending email:", error);
                res.status(500).send('Error sending email: ' + error.message);
              } else { //if email is found
                console.log('Email sent: ' + info.response);
                res.status(200).send('The password reset was sent to your email.');
              }
            });
          }
        });
      } else { //print if email is not found
        res.status(401).send('The Email you provided was not found');
      }
    });
  });


// Reset password handler
exports.HandleResetPassword = asyncHandler(async (req, res) => {
    const { email, newPassword, token } = req.body;

    // Check if email, newPassword, and token are provided
    if (!email || !newPassword || !token) {
        return res.status(400).json({ error: 'Email, newPassword, and token needed.' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Verify the reset token in the database
    database.query(t, [email, token], (error, results) => {
        if (error) {
            console.error('Error verifying reset token:', error);
            return res.status(500).json({ error: 'error cannot verify reset token.' });
        }

        // Check if token is valid
        if (results.length === 0) {
            return res.status(400).json({ error: 'expired or invalid reset token.' });
        }

        // Update the user's password in database
        database.query(r, [hashedPassword, email], (updateError, updateResults) => {
            if (updateError) {
                console.error('Error updating password:', updateError);
                return res.status(500).json({ error: 'error occurred while updating the password.' });
            }

            // Delete token from database
            database.query(w, [email], (deleteError, deleteResults) => {
                if (deleteError) {
                    console.error('Error deleting reset token:', deleteError);
                    
                }
                res.status(200).json({ message: 'The Password you provided has been reset successfully.' });
            });
        });
    });
});



  
}










