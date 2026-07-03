const { dbQuery } = require('../config/database');

/**
 * Controlador de Productos y Categorías (Públicos)
 */
class ProductController {
  /**
   * Obtiene todos los productos con filtros opcionales de búsqueda y categoría.
   */
  static async getProducts(req, res) {
    const { category, search } = req.query;

    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      sql += ' AND (c.slug = ? OR c.id = ?)';
      params.push(category, category);
    }

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // Ordenar por más recientes por defecto
    sql += ' ORDER BY p.id DESC';

    try {
      const products = await dbQuery.all(sql, params);
      return res.status(200).json(products);
    } catch (error) {
      console.error('Error al obtener productos:', error);
      return res.status(500).json({ error: 'Error al obtener la lista de productos' });
    }
  }

  /**
   * Obtiene un producto por su ID.
   */
  static async getProductById(req, res) {
    const { id } = req.params;

    try {
      const product = await dbQuery.get(
        `SELECT p.*, c.name as category_name 
         FROM products p
         JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`,
        [id]
      );

      if (!product) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      return res.status(200).json(product);
    } catch (error) {
      console.error('Error al obtener producto por ID:', error);
      return res.status(500).json({ error: 'Error al obtener detalles del producto' });
    }
  }

  /**
   * Obtiene todas las categorías disponibles.
   */
  static async getCategories(req, res) {
    try {
      const categories = await dbQuery.all('SELECT * FROM categories ORDER BY name ASC');
      return res.status(200).json(categories);
    } catch (error) {
      console.error('Error al obtener categorías:', error);
      return res.status(500).json({ error: 'Error al obtener categorías' });
    }
  }
}

module.exports = ProductController;
