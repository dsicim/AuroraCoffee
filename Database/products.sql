USE 308_db;

-- 1. Table for Categories (Support for Main and Subcategories)
CREATE TABLE IF NOT EXISTS categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id BIGINT UNSIGNED DEFAULT NULL,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 2. Table for Products
CREATE TABLE IF NOT EXISTS products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    category_id BIGINT UNSIGNED,
    weight INT, -- Weight in grams
    -- Coffee specific attributes (as mentioned in Store Overview)
    origin VARCHAR(100),
    roast_level VARCHAR(50), 
    acidity VARCHAR(50),
    flavor_notes TEXT,
    -- Accessories specific attributes (as mentioned in Store Overview)
    material VARCHAR(100),
    capacity VARCHAR(50),
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 3. Inserting Category Structure
-- Main Categories
INSERT INTO categories (name, parent_id) VALUES ('Coffee', NULL); -- ID: 1
SET @coffee_id = LAST_INSERT_ID();

INSERT INTO categories (name, parent_id) VALUES ('Accessories', NULL); -- ID: 2
SET @acc_id = LAST_INSERT_ID();

-- Coffee Subcategories
INSERT INTO categories (name, parent_id) VALUES ('Single Origin', @coffee_id);
INSERT INTO categories (name, parent_id) VALUES ('Blend', @coffee_id);
INSERT INTO categories (name, parent_id) VALUES ('Espresso', @coffee_id);
INSERT INTO categories (name, parent_id) VALUES ('Filter Coffee', @coffee_id);

-- Accessories Subcategories
INSERT INTO categories (name, parent_id) VALUES ('French Press', @acc_id);
INSERT INTO categories (name, parent_id) VALUES ('Mug', @acc_id);
INSERT INTO categories (name, parent_id) VALUES ('Thermos', @acc_id);
INSERT INTO categories (name, parent_id) VALUES ('Filter Paper', @acc_id);
INSERT INTO categories (name, parent_id) VALUES ('Grinder', @acc_id);
INSERT INTO categories (name, parent_id) VALUES ('Brewing Equipment', @acc_id);

-- 4. Inserting Sample Products
-- Following the pricing strategy: 250g specialty coffee ranges between 300 TL and 550 TL.

-- Sample Coffee Products
INSERT INTO products (name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Ethiopia Yirgacheffe', 'Flowery and citrusy notes with a light body.', 520.00, 50, id, 'Ethiopia', 'Light', 'High', 'Jasmine, Lemon, Peach'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Guatemala Green Valley', 'Balanced coffee with medium acidity and smooth body. Notes of chocolate and citrus make it
suitable for both filter and espresso.', 420.00, 100, id, 'Colombia', 'Medium', 'Medium', 'Caramel, Chocolate, Roasted Nuts'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Colombia Huila', 'Well-balanced with chocolate and nutty sweetness.', 380.00, 100, id, 'Colombia', 'Medium', 'Medium', 'Caramel, Chocolate, Roasted Nuts'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Napoli Blend', 'Strong and intense coffee with low acidity. Perfect for espresso lovers.', 380.00, 200, id, 'Multi-origin', 'Medium', 'Medium', 'Berry, Milk Chocolate'
FROM categories WHERE name = 'Blend' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Morning Blend', 'A smooth blend of African and South American beans.', 320.00, 200, id, 'Multi-origin', 'Medium', 'Medium', 'Berry, Milk Chocolate'
FROM categories WHERE name = 'Blend' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Brazil Santos', 'Low acidity coffee with nutty and chocolate flavors. Smooth and easy to drink.', 350.00, 100, id, 'Colombia', 'Medium', 'Medium', 'Caramel, Chocolate, Roasted Nuts'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Dark Espresso Roast', 'Perfect for a rich and creamy espresso shot.', 400.00, 75, id, 'Brazil/India', 'Dark', 'Low', 'Dark Chocolate, Toffee'
FROM categories WHERE name = 'Espresso' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Kenyan AA Filter', 'Vibrant acidity and full-bodied fruitiness.', 520.00, 30, id, 'Kenya', 'Light-Medium', 'Very High', 'Blackcurrant, Grapefruit'
FROM categories WHERE name = 'Filter Coffee' LIMIT 1;

-- Sample Accessories Products
INSERT INTO products (name, description, price, stock, category_id, material, capacity)
SELECT 'Classic French Press', 'BPA-free glass French press with stainless steel mesh.', 800.00, 25, id, 'Glass/Stainless Steel', '800ml'
FROM categories WHERE name = 'French Press' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, material, capacity)
SELECT 'Matte Black Mug', 'Minimalist ceramic mug, perfect for espresso based drinks.', 600.00, 120, id, 'Ceramic', '350ml'
FROM categories WHERE name = 'Mug' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, material, capacity)
SELECT 'Urban Thermos', 'Stays hot for 12 hours, cold for 24 hours.', 500.00, 45, id, 'Stainless Steel', '500ml'
FROM categories WHERE name = 'Thermos' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, material, capacity)
SELECT 'Burr Grinder Pro', 'High precision manual grinder with 20 settings.', 1450.00, 15, id, 'Aluminum/Steel', '40g'
FROM categories WHERE name = 'Grinder' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, material, capacity)
SELECT 'V60 Filter Paper', 'Ensures clean and smooth filter coffee brewing.', 200.00, 15, id, 'Aluminum/Steel', '40g'
FROM categories WHERE name = 'Filter Paper' LIMIT 1;

INSERT INTO products (name, description, price, stock, category_id, material, capacity)
SELECT 'Glass Drip Server', 'Heat resistant glass server for pour-over brewing.', 420.00, 60, id, 'Borosilicate Glass', '600ml'
FROM categories WHERE name = 'Brewing Equipment' LIMIT 1;
