const express = require("express");
const app = express();
const connection = require("./db");  // 👈 MySQL connection
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const JWT_SECRET = "secretkey123";

app.use(cors({
  origin: "*", 
}));
app.use(express.json());
// Middleware to protect routes
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Expect: Bearer TOKEN
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Invalid token format" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token is not valid" });
  }
};


// ================== TEST DB ==================
app.get("/test-db", (req, res) => {
  connection.query("SELECT DATABASE();", (err, result) => {
    if (err) return res.status(500).send(err);
    res.send(`Connected to database: ${result[0]["DATABASE()"]}`);
  });
});

// ================== SIGNUP ==================
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    connection.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ message: "Email already exists" });
          }
          return res.status(500).json({ message: err.message });
        }

        // 🔐 AUTO LOGIN TOKEN (VERY IMPORTANT)
        const token = jwt.sign(
          { id: result.insertId, email },
          JWT_SECRET,
          { expiresIn: "1h" }
        );

        // ✅ TOKEN RETURN KARO
        res.status(201).json({
          message: "Signup successful",
          token,
        });
      }
    );
  } catch (err) {
    res.status(500).json({ message: "Signup failed" });
  }
});


// ================== LOGIN ==================
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  connection.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) return res.status(500).json({ message: err.message });
      if (results.length === 0)
        return res.status(404).json({ message: "User not found" });

      const user = results[0];
      const match = await bcrypt.compare(password, user.password);

      if (!match)
        return res.status(400).json({ message: "Invalid password" });

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({ message: "Login successful", token });
    }
  );
});

// ================== CONTACT FORM ==================
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: email,
      to: process.env.EMAIL_USER,
      subject: "New Contact Form Message",
      text: `
      Name: ${name}
      Email: ${email}
      Message: ${message}
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    res.status(500).json({ message: "Email sending failed" });
  }
});

// ================== GET JEWELLERY ITEMS ==================
app.get("/api/jewellery", (req, res) => {
  connection.query("SELECT * FROM jewelleryitem", (err, result) => {
    if (err) {
      console.error("DB ERROR:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(result);
  });
});

// ================== UPDATE JEWELLERY ITEM ==================
app.put("/api/jewellery/:id", (req, res) => {
  const { id } = req.params;
  const { name, type, price, weight, image, description } = req.body;

  const sql = `
    UPDATE jewelleryitem 
    SET name = ?, type = ?, price = ?, weight = ?, image = ?, description = ?
    WHERE id = ?
  `;

  connection.query(
    sql,
    [name, type, price, weight, image, description, id],
    (err, result) => {
      if (err) {
        console.error("DB UPDATE ERROR:", err);
        return res.status(500).json({ error: "Database update failed" });
      }

      res.json({ message: "Item updated successfully" });
    }
  );
});
// GET profile
app.get("/api/profile", authMiddleware, (req, res) => {
  const { id } = req.user;
  connection.query(
    "SELECT id, name, email FROM users WHERE id = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (results.length === 0) return res.status(404).json({ message: "User not found" });
      res.json(results[0]);
    }
  );
});

// UPDATE profile
app.put("/api/profile", authMiddleware, (req, res) => {
  const { id } = req.user;
  const { name } = req.body;

  connection.query(
    "UPDATE users SET name = ? WHERE id = ?",
    [name, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Database update failed" });

      // Fetch updated profile
      connection.query(
        "SELECT id, name, email FROM users WHERE id = ?",
        [id],
        (err2, results) => {
          if (err2) return res.status(500).json({ message: "Database error" });
          res.json(results[0]);
        }
      );
    }
  );
});

app.post("/api/cart/add", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body;

  const checkQuery = "SELECT * FROM cart WHERE user_id = ? AND product_id = ?";
  connection.query(checkQuery, [userId, productId], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });

    if (result.length > 0) {
      connection.query(
        "UPDATE cart SET quantity = quantity + 1 WHERE user_id = ? AND product_id = ?",
        [userId, productId],
        () => res.json({ message: "Quantity increased" })
      );
    } else {
      connection.query(
        "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, 1)",
        [userId, productId],
        () => res.json({ message: "Item added to cart" })
      );
    }
  });
});
// cart page mai database se product show karwa rha hai 
app.get("/api/cart", authMiddleware, (req, res) => {
  const userId = req.user.id;

  const sql = `
    SELECT 
      cart.id,
      cart.quantity,
      jewelleryitem.name,
      jewelleryitem.price,
      jewelleryitem.image
    FROM cart
    JOIN jewelleryitem ON cart.product_id = jewelleryitem.id
    WHERE cart.user_id = ?
  `;

  connection.query(sql, [userId], (err, result) => {
    if (err) {
      console.log("CART FETCH ERROR:", err);
      return res.status(500).json({ message: "DB error" });
    }

    res.json(result);
  });
});

// ================== PLACE ORDER ==================
app.post("/api/order", authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { address, paymentMethod } = req.body;

  // 1️⃣ CART DATA FETCH
  const cartSql = `
    SELECT 
      cart.product_id,
      cart.quantity,
      jewelleryitem.price
    FROM cart
    JOIN jewelleryitem ON cart.product_id = jewelleryitem.id
    WHERE cart.user_id = ?
  `;

  connection.query(cartSql, [userId], (err, cartItems) => {
    if (err) return res.status(500).json({ message: "Cart fetch error" });
    if (cartItems.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    // 2️⃣ TOTAL CALCULATION
    let totalAmount = 0;
    cartItems.forEach(item => {
      totalAmount += item.price * item.quantity;
    });

    // 3️⃣ INSERT ORDER
    const orderSql = `
      INSERT INTO orders (user_id, total_amount, address, payment_method)
      VALUES (?, ?, ?, ?)
    `;

    connection.query(
      orderSql,
      [userId, totalAmount, address, paymentMethod],
      (err, orderResult) => {
        if (err) return res.status(500).json({ message: "Order failed" });

        const orderId = orderResult.insertId;

        // 4️⃣ INSERT ORDER ITEMS
        const itemSql = `
          INSERT INTO order_items (order_id, product_id, quantity, price)
          VALUES ?
        `;

        const values = cartItems.map(item => [
          orderId,
          item.product_id,
          item.quantity,
          item.price
        ]);

        connection.query(itemSql, [values], err => {
          if (err)
            return res.status(500).json({ message: "Order items failed" });

          // 5️⃣ CLEAR CART
          connection.query(
            "DELETE FROM cart WHERE user_id = ?",
            [userId],
            () => {
              res.json({
                message: "Order placed successfully",
                orderId,
                totalAmount
              });
            }
          );
        });
      }
    );
  });
});




// ================== SERVER START ==================
const PORT = 2000;
app.listen(PORT, () =>
  console.log(`🚀 SERVER STARTED ON PORT ${PORT}`)
);

module.exports = app;
