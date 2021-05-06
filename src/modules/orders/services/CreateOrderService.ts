import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
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
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('OrdersRepository') private ordersRepository: IOrdersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not registered');
    }

    const products_id = products.map(product => {
      return { id: product.id };
    });

    const productsFound = await this.productsRepository.findAllById(
      products_id,
    );

    // Caso hajam duplicadas, talvez mude o tamanho por isso
    if (products.length !== productsFound.length) {
      throw new AppError("Some products don't exist");
    }

    const productsUpdatedQuantity: IUpdateProductsQuantityDTO[] = [];

    const productsFinal = products.map(product => {
      const prodMatched = productsFound.find(prod => prod.id === product.id);

      if (!prodMatched) {
        throw new AppError('Product not found');
      }

      const quantityUpdated = prodMatched.quantity - product.quantity;

      if (quantityUpdated < 0) {
        throw new AppError('Quantity not suficient');
      }

      productsUpdatedQuantity.push({
        id: product.id,
        quantity: quantityUpdated,
      });

      return {
        product_id: product.id,
        quantity: product.quantity,
        price: prodMatched.price,
      };
    });

    // Atualizar babaquice @@

    await this.productsRepository.updateQuantity(productsUpdatedQuantity);

    const order = await this.ordersRepository.create({
      customer,
      products: productsFinal,
    });

    return order;
  }
}

export default CreateOrderService;
