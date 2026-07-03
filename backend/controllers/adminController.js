const { dbQuery } = require('../config/database');
const NotifyService = require('../services/notifyService');

/**
 * Controlador de Administración
 */
class AdminController {
  /**
   * Obtiene todos los usuarios del sistema.
   */
  static async getUsers(req, res) {
    try {
      const users = await dbQuery.all(
        'SELECT id, email, full_name, role, auth_provider, created_at FROM users ORDER BY created_at DESC'
      );
      return res.status(200).json(users);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      return res.status(500).json({ error: 'Error al obtener la lista de usuarios' });
    }
  }

  /**
   * Crea un nuevo producto.
   */
  static async createProduct(req, res) {
    const { name, description, price, stock, imageUrl, categoryId } = req.body;

    if (!name || price === undefined || stock === undefined || !categoryId) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes: name, price, stock, categoryId' });
    }

    if (price < 0 || stock < 0) {
      return res.status(400).json({ error: 'El precio y el stock no pueden ser valores negativos' });
    }

    try {
      // Verificar si la categoría existe
      const category = await dbQuery.get('SELECT id FROM categories WHERE id = ?', [categoryId]);
      if (!category) {
        return res.status(400).json({ error: 'La categoría especificada no existe' });
      }

      const result = await dbQuery.run(
        `INSERT INTO products (name, description, price, stock, image_url, category_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, description, price, stock, imageUrl || null, categoryId]
      );

      const newProduct = await dbQuery.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
      return res.status(201).json({
        message: 'Producto creado exitosamente',
        product: newProduct
      });
    } catch (error) {
      console.error('Error al crear producto:', error);
      return res.status(500).json({ error: 'Error del servidor al crear el producto' });
    }
  }

  /**
   * Edita un producto existente.
   */
  static async updateProduct(req, res) {
    const productId = req.params.id;
    const { name, description, price, stock, imageUrl, categoryId } = req.body;

    try {
      // Verificar si el producto existe
      const existingProduct = await dbQuery.get('SELECT * FROM products WHERE id = ?', [productId]);
      if (!existingProduct) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      if (price !== undefined && price < 0) {
        return res.status(400).json({ error: 'El precio no puede ser negativo' });
      }
      if (stock !== undefined && stock < 0) {
        return res.status(400).json({ error: 'El stock no puede ser negativo' });
      }

      // Validar categoría si se va a actualizar
      if (categoryId) {
        const category = await dbQuery.get('SELECT id FROM categories WHERE id = ?', [categoryId]);
        if (!category) {
          return res.status(400).json({ error: 'La categoría especificada no existe' });
        }
      }

      const updatedName = name !== undefined ? name : existingProduct.name;
      const updatedDescription = description !== undefined ? description : existingProduct.description;
      const updatedPrice = price !== undefined ? price : existingProduct.price;
      const updatedStock = stock !== undefined ? stock : existingProduct.stock;
      const updatedImageUrl = imageUrl !== undefined ? imageUrl : existingProduct.image_url;
      const updatedCategoryId = categoryId !== undefined ? categoryId : existingProduct.category_id;

      await dbQuery.run(
        `UPDATE products 
         SET name = ?, description = ?, price = ?, stock = ?, image_url = ?, category_id = ?
         WHERE id = ?`,
        [updatedName, updatedDescription, updatedPrice, updatedStock, updatedImageUrl, updatedCategoryId, productId]
      );

      const updatedProduct = await dbQuery.get('SELECT * FROM products WHERE id = ?', [productId]);
      return res.status(200).json({
        message: 'Producto actualizado exitosamente',
        product: updatedProduct
      });
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      return res.status(500).json({ error: 'Error del servidor al actualizar el producto' });
    }
  }

  /**
   * Elimina un producto.
   */
  static async deleteProduct(req, res) {
    const productId = req.params.id;

    try {
      const existingProduct = await dbQuery.get('SELECT id FROM products WHERE id = ?', [productId]);
      if (!existingProduct) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      await dbQuery.run('DELETE FROM products WHERE id = ?', [productId]);
      return res.status(200).json({ message: 'Producto eliminado exitosamente del catálogo' });
    } catch (error) {
      // Capturar restricción de clave foránea (ON DELETE RESTRICT en order_items)
      if (error.message.includes('FOREIGN KEY constraint failed') || error.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({
          error: 'No se puede eliminar este producto porque está asociado a pedidos históricos de clientes. Considere editar su stock a 0 para desactivarlo.'
        });
      }
      console.error('Error al eliminar producto:', error);
      return res.status(500).json({ error: 'Error del servidor al eliminar el producto' });
    }
  }

  /**
   * Obtiene la lista de todos los pedidos del sistema.
   */
  static async getOrders(req, res) {
    try {
      const orders = await dbQuery.all(
        `SELECT o.*, u.email as client_email, u.full_name as client_name
         FROM orders o
         JOIN users u ON o.user_id = u.id
         ORDER BY o.created_at DESC`
      );
      return res.status(200).json(orders);
    } catch (error) {
      console.error('Error al obtener todos los pedidos:', error);
      return res.status(500).json({ error: 'Error al obtener la lista de pedidos' });
    }
  }

  /**
   * Actualiza el estado de un pedido (shipped, delivered, etc.).
   */
  static async updateOrderStatus(req, res) {
    const orderId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refund_requested', 'refunded'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` });
    }

    try {
      const order = await dbQuery.get('SELECT * FROM orders WHERE id = ?', [orderId]);
      if (!order) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      await dbQuery.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

      // Notificar al cliente correspondiente sobre el cambio de estado del pedido
      let statusMsg = '';
      switch (status) {
        case 'shipped':
          statusMsg = `¡Tu pedido #${orderId} ha sido enviado! Puedes rastrearlo con tu código: ${order.tracking_number}.`;
          break;
        case 'delivered':
          statusMsg = `¡Tu pedido #${orderId} ha sido entregado exitosamente! Gracias por tu compra.`;
          break;
        case 'cancelled':
          statusMsg = `Tu pedido #${orderId} ha sido cancelado por el administrador.`;
          break;
        default:
          statusMsg = `El estado de tu pedido #${orderId} ha cambiado a: ${status}.`;
      }

      await NotifyService.create(order.user_id, statusMsg, 'order_status');

      return res.status(200).json({
        message: 'Estado del pedido actualizado exitosamente',
        orderId,
        status
      });
    } catch (error) {
      console.error('Error al actualizar estado del pedido:', error);
      return res.status(500).json({ error: 'Error del servidor al actualizar el estado del pedido' });
    }
  }
}

module.exports = AdminController;
