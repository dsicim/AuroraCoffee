USE 308_db;

-- 1. Table for Categories (Support for Main and Subcategories)
CREATE TABLE IF NOT EXISTS categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id BIGINT UNSIGNED DEFAULT NULL,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Table for Brewing Methods
CREATE TABLE IF NOT EXISTS brew_methods (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);
INSERT INTO brew_methods (name, description) VALUES 
('Espresso', 'Find grind for espresso machines'),
('Filter', 'Medium grind for filter coffee machines'),
('French Press', 'Coarse grind for French Press'),
('Chemex', 'Medium-coarse grind for Chemex'),
('V60', 'Medium-fine grind for Hario V60'),
('AeroPress', 'Medium-fine to fine grind for AeroPress'),
('Beans', 'Whole coffee beans');


-- 2. Table for Products
CREATE TABLE IF NOT EXISTS products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(50) UNIQUE DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    has_variants BOOLEAN DEFAULT FALSE,
    category_id BIGINT UNSIGNED,
    weight INT, -- Weight in grams
    tax INT DEFAULT 0,
    -- Coffee specific attributes (as mentioned in Store Overview)
    origin VARCHAR(100),
    roast_level VARCHAR(50), 
    acidity VARCHAR(50),
    flavor_notes TEXT,
    -- Accessories specific attributes (as mentioned in Store Overview)
    material VARCHAR(100),
    capacity VARCHAR(50),
    discount_rate DECIMAL(5, 2) DEFAULT 0.00,
    warranty_status VARCHAR(255) DEFAULT NULL,
    distributor_information VARCHAR(255) DEFAULT NULL,
    sales INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Table for Product Images
CREATE TABLE IF NOT EXISTS product_images (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    variant_id BIGINT UNSIGNED DEFAULT NULL,
    image_url VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);

-- Product Option Groups
CREATE TABLE IF NOT EXISTS product_option_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED,
    name VARCHAR(255) NOT NULL, -- e.g., Weight, Grind, Color
    group_code VARCHAR(255) DEFAULT NULL,
    cumulative_stock BOOLEAN DEFAULT FALSE,
    separate_stock BOOLEAN DEFAULT FALSE,
    separate_price BOOLEAN DEFAULT FALSE,
    is_required BOOLEAN DEFAULT TRUE,
    multi_select BOOLEAN DEFAULT FALSE,
    priority INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Product Option Values
CREATE TABLE IF NOT EXISTS product_option_values (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_option_group_id BIGINT UNSIGNED,
    label VARCHAR(255) NOT NULL, -- e.g., 250g, Espresso, Black,
    description TEXT,
    value_code VARCHAR(100),
    price_add DECIMAL(10, 2) UNSIGNED DEFAULT 0,
    price_mult DECIMAL(10, 4) UNSIGNED DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_option_group_id) REFERENCES product_option_groups(id) ON DELETE CASCADE
);

-- Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED,
    variant_code VARCHAR(255),
    price_add DECIMAL(10, 2) UNSIGNED DEFAULT 0,
    price_mult DECIMAL(10, 4) UNSIGNED DEFAULT 1,
    stock INT DEFAULT 0,
    sales INT DEFAULT 0,
    discount_rate DECIMAL(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Product Variant Values Mapping
CREATE TABLE IF NOT EXISTS product_variant_values (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_variant_id BIGINT UNSIGNED,
    product_option_value_id BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY (product_option_value_id) REFERENCES product_option_values(id) ON DELETE CASCADE
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
INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Ethiopia Yirgacheffe', 'ethiopia-yirgacheffe', 'Flowery and citrusy notes with a light body.', 520.00, 65, id, 'Ethiopia', 'Light', 'High', 'Jasmine, Lemon, Peach'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Guatemala Green Valley', 'guatemala-green-valley', 'Balanced coffee with medium acidity and smooth body. Notes of chocolate and citrus make it
suitable for both filter and espresso.', 420.00, 100, id, 'Colombia', 'Medium', 'Medium', 'Caramel, Chocolate, Roasted Nuts'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Colombia Huila', 'colombia-huila', 'Well-balanced with chocolate and nutty sweetness.', 380.00, 100, id, 'Colombia', 'Medium', 'Medium', 'Caramel, Chocolate, Roasted Nuts'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Napoli Blend', 'napoli-blend', 'Strong and intense coffee with low acidity. Perfect for espresso lovers.', 380.00, 200, id, 'Multi-origin', 'Medium', 'Medium', 'Berry, Milk Chocolate'
FROM categories WHERE name = 'Blend' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Morning Blend', 'morning-blend', 'A smooth blend of African and South American beans.', 320.00, 200, id, 'Multi-origin', 'Medium', 'Medium', 'Berry, Milk Chocolate'
FROM categories WHERE name = 'Blend' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Brazil Santos', 'brazil-santos', 'Low acidity coffee with nutty and chocolate flavors. Smooth and easy to drink.', 350.00, 100, id, 'Colombia', 'Medium', 'Medium', 'Caramel, Chocolate, Roasted Nuts'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Dark Espresso Roast', 'dark-espresso-roast', 'Perfect for a rich and creamy espresso shot.', 400.00, 75, id, 'Brazil/India', 'Dark', 'Low', 'Dark Chocolate, Toffee'
FROM categories WHERE name = 'Espresso' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Kenyan AA Filter', 'kenyan-aa-filter', 'Vibrant acidity and full-bodied fruitiness.', 520.00, 30, id, 'Kenya', 'Light-Medium', 'Very High', 'Blackcurrant, Grapefruit'
FROM categories WHERE name = 'Filter Coffee' LIMIT 1;

-- Sample Accessories Products
INSERT INTO products (name, product_code, description, price, stock, category_id, material, capacity)
SELECT 'Classic French Press', 'classic-french-press', 'BPA-free glass French press with stainless steel mesh.', 800.00, 25, id, 'Glass/Stainless Steel', '800ml'
FROM categories WHERE name = 'French Press' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, material, capacity)
SELECT 'Matte Black Mug', 'matte-black-mug', 'Minimalist ceramic mug, perfect for espresso based drinks.', 600.00, 120, id, 'Ceramic', '350ml'
FROM categories WHERE name = 'Mug' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, material, capacity)
SELECT 'Urban Thermos', 'urban-thermos', 'Stays hot for 12 hours, cold for 24 hours.', 500.00, 45, id, 'Stainless Steel', '500ml'
FROM categories WHERE name = 'Thermos' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, material, capacity)
SELECT 'Burr Grinder Pro', 'burr-grinder-pro', 'High precision manual grinder with 20 settings.', 1450.00, 15, id, 'Aluminum/Steel', '40g'
FROM categories WHERE name = 'Grinder' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, material, capacity)
SELECT 'V60 Filter Paper', 'v60-filter-paper', 'Ensures clean and smooth filter coffee brewing.', 200.00, 15, id, 'Aluminum/Steel', '40g'
FROM categories WHERE name = 'Filter Paper' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, material, capacity)
SELECT 'Glass Drip Server', 'glass-drip-server', 'Heat resistant glass server for pour-over brewing.', 420.00, 60, id, 'Borosilicate Glass', '600ml'
FROM categories WHERE name = 'Brewing Equipment' LIMIT 1;

-- 5. Creating variants for Ethiopia Yirgacheffe
UPDATE products SET has_variants = TRUE WHERE name = 'Ethiopia Yirgacheffe';
SET @ethiopia_id = (SELECT id FROM products WHERE name = 'Ethiopia Yirgacheffe' LIMIT 1);

INSERT INTO product_option_groups (product_id, name, cumulative_stock, group_code) VALUES (@ethiopia_id, 'Weight', TRUE, 'weight');
SET @eth_weight_group_id = LAST_INSERT_ID();

INSERT INTO product_option_values (product_option_group_id, label, value_code, price_add) VALUES 
(@eth_weight_group_id, '250g', '250g', 0),
(@eth_weight_group_id, '500g', '500g', 350.00),
(@eth_weight_group_id, '1kg', '1000g', 650.00);

-- 6. Creating variants for Urban Thermos (Color variants)
UPDATE products SET has_variants = TRUE WHERE name = 'Urban Thermos';
SET @thermos_id = (SELECT id FROM products WHERE name = 'Urban Thermos' LIMIT 1);

INSERT INTO product_option_groups (product_id, name, separate_stock, group_code) VALUES (@thermos_id, 'Color', TRUE, 'color');
SET @thermos_color_group_id = LAST_INSERT_ID();

INSERT INTO product_option_values (product_option_group_id, label, value_code, price_add) VALUES 
(@thermos_color_group_id, 'Red', 'red', 0),
(@thermos_color_group_id, 'Black', 'black', 0);

-- Insert weight variant combinations for all coffee products
UPDATE products SET has_variants = TRUE WHERE id IN (2,3,4,5,6,7,8);
INSERT INTO product_option_groups (product_id, name, cumulative_stock, group_code) VALUES
(2, 'Weight', TRUE, 'weight'),
(3, 'Weight', TRUE, 'weight'),
(4, 'Weight', TRUE, 'weight'),
(5, 'Weight', TRUE, 'weight'),
(6, 'Weight', TRUE, 'weight'),
(7, 'Weight', TRUE, 'weight'),
(8, 'Weight', TRUE, 'weight');

INSERT INTO product_option_values (product_option_group_id, label, value_code, price_add) VALUES
(3, '250g', '250g', 0),
(3, '500g', '500g', 350.00),
(3, '1kg', '1000g', 650.00),
(4, '250g', '250g', 0),
(4, '500g', '500g', 350.00),
(4, '1kg', '1000g', 650.00),
(5, '250g', '250g', 0),
(5, '500g', '500g', 350.00),
(5, '1kg', '1000g', 650.00),
(6, '250g', '250g', 0),
(6, '500g', '500g', 350.00),
(6, '1kg', '1000g', 650.00),
(7, '250g', '250g', 0),
(7, '500g', '500g', 350.00),
(7, '1kg', '1000g', 650.00),
(8, '250g', '250g', 0),
(8, '500g', '500g', 350.00),
(8, '1kg', '1000g', 650.00),
(9, '250g', '250g', 0),
(9, '500g', '500g', 350.00),
(9, '1kg', '1000g', 650.00);

-- Insert actual variant combinations
INSERT INTO product_variants (product_id, variant_code, price_add, price_mult, stock) VALUES
(1, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 20),
(1, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 30),
(1, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 15),
(2, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 50),
(2, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 30),
(2, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 20),
(3, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 50),
(3, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 30),
(3, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 20),
(4, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 100),
(4, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 60),
(4, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 40),
(5, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 100),
(5, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 60),
(5, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 40),
(6, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 50),
(6, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 30),
(6, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 20),
(7, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 30),
(7, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 30),
(7, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 15),
(8, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 15),
(8, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 10),
(8, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 5),
(11, 'eyJjb2xvciI6InJlZCJ9', 0, 1, 20),
(11, 'eyJjb2xvciI6ImJsYWNrIn0=', 0, 1, 25);

