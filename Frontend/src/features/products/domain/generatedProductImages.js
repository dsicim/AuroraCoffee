import brazilSantosImage from '../../../assets/products/brazil-santos.png'
import burrGrinderProImage from '../../../assets/products/burr-grinder-pro.png'
import classicFrenchPressImage from '../../../assets/products/classic-french-press.png'
import colombiaHuilaImage from '../../../assets/products/colombia-huila.png'
import darkEspressoRoastImage from '../../../assets/products/dark-espresso-roast.png'
import ethiopiaYirgacheffeImage from '../../../assets/products/ethiopia-yirgacheffe.png'
import glassDripServerImage from '../../../assets/products/glass-drip-server.png'
import guatemalaGreenValleyImage from '../../../assets/products/guatemala-green-valley.png'
import kenyanAaFilterImage from '../../../assets/products/kenyan-aa-filter.png'
import matteBlackMugImage from '../../../assets/products/matte-black-mug.png'
import morningBlendImage from '../../../assets/products/morning-blend.png'
import napoliBlendImage from '../../../assets/products/napoli-blend.png'
import urbanThermosImage from '../../../assets/products/urban-thermos.png'
import v60FilterPaperImage from '../../../assets/products/v60-filter-paper.png'

const productImageBySlug = Object.freeze({
  'brazil-santos': brazilSantosImage,
  'burr-grinder-pro': burrGrinderProImage,
  'classic-french-press': classicFrenchPressImage,
  'colombia-huila': colombiaHuilaImage,
  'dark-espresso-roast': darkEspressoRoastImage,
  'ethiopia-yirgacheffe': ethiopiaYirgacheffeImage,
  'glass-drip-server': glassDripServerImage,
  'guatemala-green-valley': guatemalaGreenValleyImage,
  'kenyan-aa-filter': kenyanAaFilterImage,
  'matte-black-mug': matteBlackMugImage,
  'morning-blend': morningBlendImage,
  'napoli-blend': napoliBlendImage,
  'urban-thermos': urbanThermosImage,
  'v60-filter-paper': v60FilterPaperImage,
})

export function getGeneratedProductImageUrl(product) {
  return productImageBySlug[String(product?.slug || '').trim()] || ''
}
