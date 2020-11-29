import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('Could not find any customer with the given id');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    // if (!existentProducts.length) {
    //   throw new AppError('Could not find any products with the given ids');
    // }

    const existentProductsIds = existentProducts.map(product => product.id);

    const inexistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (inexistentProducts.length) {
      throw new AppError('Could not find all the products with the given ids');
    }

    const productsWithInsufficientQuantity = products.filter(
      product =>
        existentProducts.filter(
          existentProduct => existentProduct.id === product.id,
        )[0].quantity < product.quantity,
    );

    if (productsWithInsufficientQuantity.length) {
      throw new AppError(
        'Could not find available quantities for all the products',
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(
        existentProduct => existentProduct.id === product.id,
      )[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: serializedProducts,
    });

    const updateProductsQuantities = order.order_products.map(product => ({
      id: product.product_id,
      quantity:
        existentProducts.filter(
          existentProduct => existentProduct.id === product.product_id,
        )[0].quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(updateProductsQuantities);

    return order;
  }
}

export default CreateOrderService;
