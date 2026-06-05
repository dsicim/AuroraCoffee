SET FOREIGN_KEY_CHECKS=0;
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
    model VARCHAR(255) DEFAULT NULL,
    serial_number VARCHAR(255) DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
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
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
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

-- 7. Inserting the missing 10 coffees and their weight variants

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Panama Geisha', 'panama-geisha', 'An exceptionally rare coffee with a delicate, tea-like body. Floral jasmine and bergamot notes make it a truly luxurious cup.', 850.00, 20, id, 'Panama', 'Light', 'High', 'Jasmine, Bergamot, Earl Grey'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'India Monsooned Malabar', 'india-monsooned-malabar', 'A unique, heavy-bodied coffee with almost zero acidity. Exposed to monsoon winds for a distinctively earthy and spicy profile.', 420.00, 80, id, 'India', 'Dark', 'Very Low', 'Spicy, Earthy, Wood, Tobacco'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Rwanda Karongi', 'rwanda-karongi', 'A vibrant African coffee featuring sweet orange acidity and a clean, caramelized sugar finish.', 460.00, 60, id, 'Rwanda', 'Light-Medium', 'Medium-High', 'Orange, Brown Sugar, Black Tea'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Yemen Mocha Mattari', 'yemen-mocha-mattari', 'A wild and complex classic. Full-bodied with deep chocolate and dried fruit notes, ending with a winey acidity.', 750.00, 25, id, 'Yemen', 'Medium-Dark', 'Medium', 'Dark Chocolate, Dried Fruit, Winey'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'El Salvador Finca', 'el-salvador-finca', 'Smooth and easy to drink with a perfect harmony of milk chocolate and red apple sweetness. Ideal for daily brewing.', 440.00, 75, id, 'El Salvador', 'Medium', 'Medium', 'Milk Chocolate, Red Apple, Nougat'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Midnight Velvet Blend', 'midnight-velvet-blend', 'A heavy-bodied, low acidity blend crafted for the perfect late-night espresso. Rich notes of dark cocoa and roasted almonds.', 390.00, 150, id, 'Blend (Asia & South America)', 'Dark', 'Low', 'Cocoa Nibs, Roasted Almond, Treacle'
FROM categories WHERE name = 'Blend' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Nicaragua SHG EP', 'nicaragua-shg-ep', 'High-altitude grown beans offering a mild acidity and a sweet, comforting finish with hints of vanilla and hazelnut.', 410.00, 90, id, 'Nicaragua', 'Medium', 'Medium-Low', 'Hazelnut, Vanilla, Caramel'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Uganda Rwenzori', 'uganda-rwenzori', 'A sweet and full-bodied cup showcasing an exciting mix of tropical fruits and rich cacao.', 430.00, 50, id, 'Uganda', 'Medium', 'Medium', 'Tropical Fruit, Cacao, Honey'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Mexico Altura', 'mexico-altura', 'A refreshing, light-bodied coffee with mild chocolate and roasted peanut notes. Great for a smooth morning drip.', 380.00, 110, id, 'Mexico', 'Medium', 'Medium-Low', 'Roasted Peanut, Cinnamon, Chocolate'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

INSERT INTO products (name, product_code, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes)
SELECT 'Decaf Swiss Water Peru', 'decaf-swiss-water-peru', 'A completely chemical-free decaf that retains all its rich flavor. Smooth notes of toasted walnut and molasses.', 480.00, 40, id, 'Peru', 'Medium', 'Medium', 'Toasted Walnut, Molasses, Mild Apple'
FROM categories WHERE name = 'Single Origin' LIMIT 1;

UPDATE products SET has_variants = TRUE WHERE id IN (15,16,17,18,19,20,21,22,23,24);

INSERT INTO product_option_groups (product_id, name, cumulative_stock, group_code) VALUES
(15, 'Weight', TRUE, 'weight'),
(16, 'Weight', TRUE, 'weight'),
(17, 'Weight', TRUE, 'weight'),
(18, 'Weight', TRUE, 'weight'),
(19, 'Weight', TRUE, 'weight'),
(20, 'Weight', TRUE, 'weight'),
(21, 'Weight', TRUE, 'weight'),
(22, 'Weight', TRUE, 'weight'),
(23, 'Weight', TRUE, 'weight'),
(24, 'Weight', TRUE, 'weight');

INSERT INTO product_option_values (product_option_group_id, label, value_code, price_add, price_mult) VALUES
(10, '250g', '250g', 0, 1),
(10, '500g', '500g', 350.00, 1),
(10, '1kg', '1000g', 650.00, 1),
(11, '250g', '250g', 0, 1),
(11, '500g', '500g', 350.00, 1),
(11, '1kg', '1000g', 650.00, 1),
(12, '250g', '250g', 0, 1),
(12, '500g', '500g', 350.00, 1),
(12, '1kg', '1000g', 650.00, 1),
(13, '250g', '250g', 0, 1),
(13, '500g', '500g', 350.00, 1),
(13, '1kg', '1000g', 650.00, 1),
(14, '250g', '250g', 0, 1),
(14, '500g', '500g', 350.00, 1),
(14, '1kg', '1000g', 650.00, 1),
(15, '250g', '25０g', 0, 1),
(15, '500g', '500g', 350.00, 1),
(15, '1kg', '1000g', 650.00, 1),
(16, '250g', '250g', 0, 1),
(16, '500g', '500g', 350.00, 1),
(16, '1kg', '1000g', 650.00, 1),
(17, '250g', '250g', 0, 1),
(17, '500g', '500g', 350.00, 1),
(17, '1kg', '1000g', 650.00, 1),
(18, '250g', '250g', 0, 1),
(18, '500g', '500g', 350.00, 1),
(18, '1kg', '1000g', 650.00, 1),
(19, '250g', '250g', 0, 1),
(19, '500g', '500g', 350.00, 1),
(19, '1kg', '1000g', 650.00, 1);

INSERT INTO product_variants (product_id, variant_code, price_add, price_mult, stock) VALUES
(15, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 10),
(15, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 6),
(15, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 4),
(16, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 40),
(16, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 25),
(16, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 15),
(17, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 30),
(17, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 20),
(17, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 10),
(18, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 12),
(18, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 8),
(18, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 5),
(19, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 35),
(19, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 25),
(19, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 15),
(20, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 75),
(20, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 45),
(20, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 30),
(21, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 45),
(21, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 30),
(21, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 15),
(22, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 25),
(22, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 15),
(22, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 10),
(23, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 55),
(23, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 35),
(23, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 20),
(24, 'eyJ3ZWlnaHQiOiIyNTBnIn0=', 0, 1, 20),
(24, 'eyJ3ZWlnaHQiOiI1MDBnIn0=', 350.00, 1, 12),
(24, 'eyJ3ZWlnaHQiOiIxMDAwZyJ9', 650.00, 1, 8);

-- 8. Inserting missing accessories
INSERT INTO products (name, product_code, model, serial_number, warranty_status, distributor_information, description, price, stock, category_id, material, capacity)
SELECT 'Pro Stainless Steel French Press', 'pro-stainless-french-press', 'PRO-FP-01', 'SN-PFP-1001', '2 Years', 'Aurora Coffee', 'Premium double-walled stainless steel French press. Retains heat significantly longer than glass and is virtually indestructible for professional use.', 1400.00, 40, id, 'Stainless Steel', '1000ml'
FROM categories WHERE name = 'French Press' LIMIT 1;

INSERT INTO products (name, product_code, model, serial_number, warranty_status, distributor_information, description, price, stock, category_id, material, capacity)
SELECT 'Campfire Enamel Mug', 'campfire-enamel-mug', 'CE-MUG-02', 'SN-CEM-2002', 'No Warranty', 'Aurora Coffee', 'Durable and lightweight vintage-style enamel mug. Perfect for camping or daily outdoor use.', 250.00, 150, id, 'Enamel/Steel', '400ml'
FROM categories WHERE name = 'Mug' LIMIT 1;

INSERT INTO products (name, product_code, model, serial_number, warranty_status, distributor_information, description, price, stock, category_id, material, capacity)
SELECT 'Smart Temperature Thermos', 'smart-temperature-thermos', 'STT-03', 'SN-STT-3003', '2 Years', 'Aurora Coffee', 'Insulated thermos with an integrated LED temperature display on the lid. Keeps drinks hot for 12 hours.', 650.00, 50, id, 'Stainless Steel', '500ml'
FROM categories WHERE name = 'Thermos' LIMIT 1;

INSERT INTO products (name, product_code, model, serial_number, warranty_status, distributor_information, description, price, stock, category_id, material, capacity)
SELECT 'Electric Burr Grinder', 'electric-burr-grinder', 'EBG-04', 'SN-EBG-4004', '2 Years', 'Brewing Tech Ltd.', 'Professional conical burr grinder with 30 precise grind settings from espresso to French press.', 3200.00, 15, id, 'Steel/Plastic', '250g'
FROM categories WHERE name = 'Grinder' LIMIT 1;

SET FOREIGN_KEY_CHECKS=1;
