
export type BlockType = 'hero' | 'text' | 'button' | 'divider' | 'image-text' | 'image' | 'social' | 'video' | 'services' | 'image-grid';

export interface EmailBlock {
  id: string;
  type: BlockType;
  content: any;
}

export const FONTS = [
  { name: 'Default (System)', value: 'Inter, system-ui, sans-serif' },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  { name: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { name: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { name: 'Courier New', value: '"Courier New", Courier, monospace' },
  { name: 'Lucida Console', value: '"Lucida Console", Monaco, monospace' },
];

export const PREMADE_TEMPLATES = [
  {
    id: 'spotlight',
    name: 'Weekly Spotlight',
    description: 'A balanced layout with hero, image gallery, and services.',
    blocks: [
      { id: '1', type: 'hero', content: { title: 'WEEKLY SPOTLIGHT', subtitle: 'Our latest updates and premium offers' } },
      { id: '2', type: 'image-grid', content: { 
        rows: 1, 
        columns: 2, 
        backgroundColor: '#ffffff',
        items: [
          { url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=400', linkText: 'View Details', linkUrl: '#' },
          { url: 'https://images.unsplash.com/photo-1530046339160-ce3e5b0c7a2f?auto=format&fit=crop&q=80&w=400', linkText: 'View Details', linkUrl: '#' }
        ] 
      } },
      { id: '3', type: 'text', content: { text: 'Welcome to our latest newsletter! We have some exciting news to share with you this week.' } },
      { id: '4', type: 'services', content: { items: ['Quick Service', 'Deep Cleaning', 'Oil Change'] } },
      { id: '5', type: 'button', content: { label: 'LEARN MORE', url: '#' } },
      { id: '6', type: 'social', content: { facebook: '#', instagram: '#', twitter: '#' } }
    ] as EmailBlock[]
  },
  {
    id: 'promo',
    name: 'Flash Promotion',
    description: 'High impact layout designed to drive immediate sales.',
    blocks: [
      { id: '1', type: 'hero', content: { title: 'FLASH SALE: 50% OFF', subtitle: 'Book your service before midnight.' } },
      { id: '2', type: 'image', content: { url: 'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?auto=format&fit=crop&q=80&w=600' } },
      { id: '3', type: 'text', content: { text: 'For the next 24 hours, we are offering an unprecedented 50% discount on all premium detailing services. Do not miss out!' } },
      { id: '4', type: 'button', content: { label: 'CLAIM DISCOUNT', url: '#' } },
      { id: '5', type: 'divider', content: {} },
      { id: '6', type: 'social', content: { facebook: '#', instagram: '#', twitter: '#' } }
    ] as EmailBlock[]
  },
  {
    id: 'announcement',
    name: 'Feature Announcement',
    description: 'Clean and informative layout for product updates.',
    blocks: [
      { id: '1', type: 'hero', content: { title: 'BIG UPDATE', subtitle: 'We just launched something amazing.' } },
      { id: '2', type: 'video', content: { url: '#' } },
      { id: '3', type: 'text', content: { text: 'We are thrilled to announce our brand new online booking system. It is now faster and easier than ever to schedule your repairs.' } },
      { id: '4', type: 'button', content: { label: 'TRY IT NOW', url: '#' } }
    ] as EmailBlock[]
  },
  {
    id: 'review-request',
    name: 'Customer Review Request',
    description: 'A focused template to encourage customer feedback and ratings.',
    blocks: [
      { id: '1', type: 'hero', content: { title: 'HOW DID WE DO?', subtitle: 'We value your honest feedback.' } },
      { id: '2', type: 'text', content: { text: 'Thank you for choosing us for your recent service! To help us continue providing top-tier experiences, we would love to hear your thoughts. It only takes a minute.' } },
      { id: '3', type: 'button', content: { label: 'LEAVE A REVIEW', url: '#' } },
      { id: '4', type: 'social', content: { facebook: '#', instagram: '#', twitter: '#' } }
    ] as EmailBlock[]
  },
  {
    id: 'holiday-special',
    name: 'Holiday Special',
    description: 'Festive, image-heavy layout for seasonal campaigns.',
    blocks: [
      { id: '1', type: 'hero', content: { title: 'SEASON\'S GREETINGS', subtitle: 'Celebrate with our special holiday discounts!' } },
      { id: '2', type: 'image', content: { url: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&q=80&w=600' } },
      { id: '3', type: 'text', content: { text: 'The holidays are here, and we want to celebrate with you! Treat your vehicle to our exclusive holiday detailing packages at a fraction of the cost.' } },
      { id: '4', type: 'services', content: { items: ['Winter Prep', 'Interior Detail', 'Wax Coating'] } },
      { id: '5', type: 'button', content: { label: 'VIEW HOLIDAY PACKAGES', url: '#' } }
    ] as EmailBlock[]
  },
  {
    id: 'monthly-digest',
    name: 'Monthly Digest',
    description: 'Comprehensive layout combining news, media, and services.',
    blocks: [
      { id: '1', type: 'hero', content: { title: 'MONTHLY DIGEST', subtitle: 'Your wrap-up of the month\'s best news.' } },
      { id: '2', type: 'image-grid', content: { 
        rows: 1, 
        columns: 2, 
        backgroundColor: '#ffffff',
        items: [
          { url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=400', linkText: 'Latest Car Tech', linkUrl: '#' },
          { url: 'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&q=80&w=400', linkText: 'Engine Care', linkUrl: '#' }
        ]
      } },
      { id: '3', type: 'text', content: { text: 'It has been a busy month! We have expanded our team, introduced new tools, and serviced over 500 vehicles. Here is a quick look at what is new.' } },
      { id: '4', type: 'divider', content: {} },
      { id: '6', type: 'text', content: { text: 'Check out our latest video detailing a complete engine rebuild process from start to finish.' } },
      { id: '7', type: 'button', content: { label: 'READ FULL NEWSLETTER', url: '#' } },
      { id: '8', type: 'social', content: { facebook: '#', instagram: '#', twitter: '#' } }
    ] as EmailBlock[]
  },
  {
    id: 'ultimate-sales-guide',
    name: 'The Ultimate Sales Guide',
    description: 'A massive, highly detailed layout for a major product launch or extensive catalog.',
    blocks: [
      { id: '1', type: 'hero', content: { title: 'THE ULTIMATE GUIDE', subtitle: 'Everything you need to know about our premium services.' } },
      { id: '2', type: 'image', content: { url: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=600' } },
      { id: '3', type: 'text', content: { text: 'Welcome to our comprehensive guide. Whether you are looking to protect your investment with ceramic coating, or just want a standard detail, we have compiled all the information you need right here.' } },
      { id: '4', type: 'divider', content: {} },
      { id: '5', type: 'hero', content: { title: 'CERAMIC COATINGS', subtitle: 'Long lasting protection.' } },
      { id: '6', type: 'image-grid', content: { 
        rows: 1, 
        columns: 2, 
        backgroundColor: '#ffffff',
        items: [
          { url: 'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?auto=format&fit=crop&q=80&w=400', linkText: 'Details', linkUrl: '#' },
          { url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=400', linkText: 'Pricing', linkUrl: '#' }
        ]
      } },
      { id: '7', type: 'text', content: { text: 'Ceramic coating provides a strong, protective surface to the car’s body that can block all manner of foreign matter and prevent them from causing damage to the car. On any given day, a car has to endure a variety of attacks to its body.' } },
      { id: '8', type: 'button', content: { label: 'BOOK CERAMIC COATING', url: '#' } },
      { id: '9', type: 'divider', content: {} },
      { id: '10', type: 'hero', content: { title: 'INTERIOR DETAILING', subtitle: 'Feel fresh inside.' } },
      { id: '11', type: 'video', content: { url: '#' } },
      { id: '12', type: 'services', content: { items: ['Steam Cleaning', 'Leather Treatment', 'Odor Removal'] } },
      { id: '13', type: 'button', content: { label: 'BOOK INTERIOR DETAIL', url: '#' } },
      { id: '14', type: 'social', content: { facebook: '#', instagram: '#', twitter: '#' } }
    ] as EmailBlock[]
  },
  {
    id: 'full-service-catalog',
    name: 'Full Service Catalog',
    description: 'An extensive breakdown of all available services, perfect for onboarding new clients.',
    blocks: [
      { id: '1', type: 'hero', content: { title: 'OUR SERVICE CATALOG', subtitle: 'Discover what we can do for you.' } },
      { id: '2', type: 'text', content: { text: 'Thank you for subscribing! As a new member, we want to make sure you are fully aware of the wide range of services we offer at our state-of-the-art facility.' } },
      { id: '3', type: 'services', content: { items: ['Basic Wash', 'Premium Wash', 'Full Detail'] } },
      { id: '4', type: 'divider', content: {} },
      { id: '5', type: 'image', content: { url: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=600' } },
      { id: '6', type: 'text', content: { text: 'Our Premium Wash includes a full hand wash, wheel cleaning, tire dressing, and an interior vacuum. It is the perfect maintenance package.' } },
      { id: '7', type: 'button', content: { label: 'SCHEDULE PREMIUM WASH', url: '#' } },
      { id: '8', type: 'divider', content: {} },
      { id: '9', type: 'services', content: { items: ['Oil Change', 'Brake Service', 'Tire Rotation'] } },
      { id: '10', type: 'text', content: { text: 'Beyond detailing, our certified mechanics are here to keep your vehicle running smoothly with routine maintenance.' } },
      { id: '11', type: 'button', content: { label: 'VIEW MECHANIC SERVICES', url: '#' } },
      { id: '12', type: 'divider', content: {} },
      { id: '13', type: 'social', content: { facebook: '#', instagram: '#', twitter: '#' } }
    ] as EmailBlock[]
  }
];
