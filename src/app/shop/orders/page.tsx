import { ShopOrders } from '@/components/shop/shop-orders';
import { TopNavigation } from '@/components/layout/top-navigation';
export const metadata={title:'My shop orders',robots:{index:false,follow:false}};
export default function Orders(){return <><TopNavigation/><ShopOrders/></>}
