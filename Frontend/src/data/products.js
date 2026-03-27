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
    price: 18,
    stock: 14,
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
  },
  {
    id: 'midnight-espresso',
    name: 'Midnight Espresso',
    roast: 'Espresso Roast',
    category: 'Espresso',
    description:
      'A fuller body blend with dark chocolate sweetness and a smooth caramel finish.',
    story:
      'Built as the reliable espresso anchor of Aurora Coffee, this blend gives the product page a bolder direction. It is forgiving on home machines and still works beautifully with milk.',
    notes: ['Chocolate', 'Caramel', 'Rich Body'],
    price: 16,
    stock: 26,
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
  },
  {
    id: 'colombia-huila',
    name: 'Colombia Huila',
    roast: 'Medium Roast',
    category: 'Everyday',
    description:
      'Balanced and approachable with panela sweetness, red fruit acidity, and cocoa.',
    story:
      'This sits in the middle of the Aurora lineup and is intended to feel broadly approachable. It gives the storefront a balanced option for customers who want complexity without too much brightness.',
    notes: ['Panela', 'Red Fruit', 'Cocoa'],
    price: 17,
    stock: 9,
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
    price: 19,
    stock: 0,
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
    price: 15,
    stock: 21,
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
  },
]

export const featuredProducts = products.filter((product) => product.featured)

export const productCategories = ['All', ...new Set(products.map((product) => product.category))]

export function getProductById(productId) {
  return products.find((product) => product.id === productId) || null
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
