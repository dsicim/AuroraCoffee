function createVariant(baseId, weight, grind, price, stock) {
  return {
    id: `${baseId}-${weight.toLowerCase()}-${grind
      .toLowerCase()
      .replace(/\s+/g, '-')}`,
    weight,
    grind,
    price,
    stock,
  }
}

export const products = [
  {
    id: 'ethiopia-guji',
    name: 'Ethiopia Guji',
    roast: 'Light Roast',
    category: 'Filter',
    description:
      'Floral and bright with bergamot, peach, and jasmine notes for crisp pour-over cups.',
    story:
      'A vibrant Ethiopian release designed for the demo catalog. It leans tea-like in structure, stays sweet as it cools, and gives the storefront a lighter profile beside the richer espresso offerings.',
    notes: ['Peach', 'Jasmine', 'Citrus'],
    rating: 4.8,
    reviewCount: 32,
    popularity: 91,
    origin: 'Guji, Ethiopia',
    brewGuide: 'Best for V60, Chemex, and batch filter.',
    reviews: [
      {
        author: 'Selin',
        score: 5,
        quote: 'Elegant and fragrant. It tastes clean even when brewed stronger.',
      },
      {
        author: 'Mert',
        score: 4,
        quote: 'A very bright cup with a soft jasmine finish.',
      },
    ],
    featured: true,
    variants: [
      createVariant('ethiopia-guji', '250g', 'Whole Bean', 18, 14),
      createVariant('ethiopia-guji', '250g', 'Filter', 18, 9),
      createVariant('ethiopia-guji', '250g', 'French Press', 18, 4),
      createVariant('ethiopia-guji', '500g', 'Whole Bean', 33, 6),
      createVariant('ethiopia-guji', '500g', 'Filter', 33, 3),
      createVariant('ethiopia-guji', '1kg', 'Whole Bean', 61, 2),
    ],
  },
  {
    id: 'midnight-espresso',
    name: 'Midnight Espresso',
    roast: 'Espresso Roast',
    category: 'Espresso',
    description:
      'A fuller body blend with dark chocolate sweetness and a smooth caramel finish.',
    story:
      'Built as the reliable espresso anchor of the catalog, this blend gives the product page a bolder direction. It is forgiving on home machines and still works beautifully with milk.',
    notes: ['Chocolate', 'Caramel', 'Rich Body'],
    rating: 4.7,
    reviewCount: 46,
    popularity: 97,
    origin: 'Brazil & Colombia',
    brewGuide: 'Best for espresso, moka pot, and milk drinks.',
    reviews: [
      {
        author: 'Deniz',
        score: 5,
        quote: 'Exactly the comforting espresso profile I wanted for cappuccinos.',
      },
      {
        author: 'Leyla',
        score: 4,
        quote: 'Chocolate-forward and easy to dial in.',
      },
    ],
    featured: true,
    variants: [
      createVariant('midnight-espresso', '250g', 'Whole Bean', 16, 26),
      createVariant('midnight-espresso', '250g', 'Espresso', 16, 18),
      createVariant('midnight-espresso', '250g', 'Moka Pot', 16, 10),
      createVariant('midnight-espresso', '500g', 'Whole Bean', 29, 8),
      createVariant('midnight-espresso', '500g', 'Espresso', 29, 5),
      createVariant('midnight-espresso', '1kg', 'Whole Bean', 54, 3),
    ],
  },
  {
    id: 'colombia-huila',
    name: 'Colombia Huila',
    roast: 'Medium Roast',
    category: 'Everyday',
    description:
      'Balanced and approachable with panela sweetness, red fruit acidity, and cocoa.',
    story:
      'This sits in the middle of the lineup and is intended to feel broadly approachable. It gives the storefront a balanced option for customers who want complexity without too much brightness.',
    notes: ['Panela', 'Red Fruit', 'Cocoa'],
    rating: 4.6,
    reviewCount: 28,
    popularity: 84,
    origin: 'Huila, Colombia',
    brewGuide: 'Works well as both filter and immersion brew.',
    reviews: [
      {
        author: 'Ayse',
        score: 5,
        quote: 'Sweet and balanced. It is the easiest coffee in the lineup to recommend.',
      },
      {
        author: 'Can',
        score: 4,
        quote: 'A dependable everyday brew with gentle fruit notes.',
      },
    ],
    featured: true,
    variants: [
      createVariant('colombia-huila', '250g', 'Whole Bean', 17, 9),
      createVariant('colombia-huila', '250g', 'Filter', 17, 7),
      createVariant('colombia-huila', '250g', 'French Press', 17, 4),
      createVariant('colombia-huila', '500g', 'Whole Bean', 31, 4),
      createVariant('colombia-huila', '500g', 'Filter', 31, 2),
      createVariant('colombia-huila', '1kg', 'Whole Bean', 57, 1),
    ],
  },
  {
    id: 'sumatra-rain',
    name: 'Sumatra Rain',
    roast: 'Dark Roast',
    category: 'Signature',
    description:
      'Deep and syrupy with cedar, black sugar, and a rounded spice finish.',
    story:
      'A heavier-bodied coffee that broadens the catalog visually and lets the product detail page show a more grounded, comforting flavor profile. It is deliberately styled as a slower, richer cup.',
    notes: ['Cedar', 'Black Sugar', 'Spice'],
    rating: 4.5,
    reviewCount: 19,
    popularity: 73,
    origin: 'Sumatra, Indonesia',
    brewGuide: 'Ideal for French press and colder mornings.',
    reviews: [
      {
        author: 'Burak',
        score: 4,
        quote: 'Heavy body and a warm finish. Great for slower weekend brews.',
      },
      {
        author: 'Zeynep',
        score: 5,
        quote: 'Very comforting and bold without tasting burnt.',
      },
    ],
    featured: false,
    variants: [
      createVariant('sumatra-rain', '250g', 'Whole Bean', 19, 0),
      createVariant('sumatra-rain', '250g', 'French Press', 19, 0),
      createVariant('sumatra-rain', '500g', 'Whole Bean', 35, 3),
      createVariant('sumatra-rain', '500g', 'French Press', 35, 2),
      createVariant('sumatra-rain', '1kg', 'Whole Bean', 64, 1),
    ],
  },
  {
    id: 'aurora-house-decaf',
    name: 'Aurora House Decaf',
    roast: 'Medium Roast',
    category: 'Decaf',
    description:
      'A soft decaf with almond sweetness, cocoa nib, and a smooth evening finish.',
    story:
      'The decaf offer rounds out the demo catalog and gives the filtering controls a meaningful category split. It is designed to feel warm and familiar rather than compromise-driven.',
    notes: ['Almond', 'Cocoa Nib', 'Brown Sugar'],
    rating: 4.4,
    reviewCount: 14,
    popularity: 65,
    origin: 'Tolima, Colombia',
    brewGuide: 'Comfortable for drip coffee and evening pour-over.',
    reviews: [
      {
        author: 'Ece',
        score: 4,
        quote: 'A decaf that still tastes like a real coffee release.',
      },
      {
        author: 'Kerem',
        score: 5,
        quote: 'Very smooth and easy to drink late in the day.',
      },
    ],
    featured: false,
    variants: [
      createVariant('aurora-house-decaf', '250g', 'Whole Bean', 15, 21),
      createVariant('aurora-house-decaf', '250g', 'Filter', 15, 12),
      createVariant('aurora-house-decaf', '500g', 'Whole Bean', 28, 7),
      createVariant('aurora-house-decaf', '500g', 'Filter', 28, 4),
      createVariant('aurora-house-decaf', '1kg', 'Whole Bean', 51, 2),
    ],
  },
]

export const featuredProducts = products.filter((product) => product.featured)

export const productCategories = [
  'All',
  ...new Set(products.map((product) => product.category)),
]

export function getProductById(productId) {
  return products.find((product) => product.id === productId) || null
}

export function getVariantById(variantId) {
  for (const product of products) {
    const variant = product.variants.find((candidate) => candidate.id === variantId)

    if (variant) {
      return { product, variant }
    }
  }

  return null
}

export function getDefaultVariant(product) {
  return (
    product.variants.find((variant) => variant.stock > 0) ||
    product.variants[0] ||
    null
  )
}

export function getMinimumVariantPrice(product) {
  return product.variants.reduce(
    (minimum, variant) => Math.min(minimum, variant.price),
    product.variants[0]?.price ?? 0,
  )
}

export function getVariantCount(product) {
  return product.variants.length
}

export function getProductAvailability(product) {
  const totalStock = product.variants.reduce(
    (total, variant) => total + variant.stock,
    0,
  )

  return {
    totalStock,
    hasStock: totalStock > 0,
  }
}

export function getRelatedProducts(product, limit = 3) {
  return products
    .filter(
      (candidate) =>
        candidate.id !== product.id &&
        (candidate.category === product.category ||
          candidate.roast === product.roast),
    )
    .slice(0, limit)
}
