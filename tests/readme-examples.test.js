// tests/readme-examples.test.js
import { expect } from '@jest/globals'
import { match, NoMatch } from '../src/impl/impl.js'

describe('README Examples', () => {
  describe('Basic Matching Example', () => {
    it('matches an array and extracts values correctly', () => {
      const result = match(
        [{ x: 1, y: { a: '2' }, z: { b: false } }],
        ([val1, val2, val3]) => [
          () => [{ x: val1, y: val2, z: { b: val3 } }],
          () => [val1, val2, val3],
        ]
      )
      expect(result).toEqual([1, { a: '2' }, false])
    })
  })

  describe('Alternative Syntaxes', () => {
    it('uses enclosing function syntax correctly', () => {
      const result = match(
        { type: 'user', name: 'John', age: 30 },
        ([type, name, age]) => [ // eslint-disable-line no-unused-vars
          () => ({ type: 'user', name, age: age.when(a => a >= 18) }),
          () => `Adult user: ${name}`,
          
          () => ({ type: 'user', name, age: age.when(a => a < 18) }),
          () => `Minor user: ${name}`,
        ]
      )
      expect(result).toBe('Adult user: John')
    })

    it('uses direct array syntax correctly', () => {
      // Reusable pattern/result pairs
      /* eslint-disable no-unused-vars */
      const adultUserPatterns = [
        ([type, name, age]) => ({ 
          type: 'user', 
          name, 
          age: age.when(a => a >= 18) 
        }),
        ([type, name, age]) => `Adult user: ${name}`,
      ]
      
      const minorUserPatterns = [
        ([type, name, age]) => ({ 
          type: 'user', 
          name, 
          age: age.when(a => a < 18) 
        }),
        ([type, name, age]) => `Minor user: ${name}`,
      ]
      
      // Combine patterns for complete user matching
      const allUserPatterns = [...adultUserPatterns, ...minorUserPatterns]
      /* eslint-enable no-unused-vars */
      
      // Use specific pattern set
      const adultResult = match(
        { type: 'user', name: 'John', age: 30 },
        adultUserPatterns
      )
      expect(adultResult).toBe('Adult user: John')
      
      // Use combined patterns
      const result = match(
        { type: 'user', name: 'Billy', age: 15 },
        allUserPatterns
      )
      expect(result).toBe('Minor user: Billy')
    })
  })

  describe('Pattern Matching with Guards', () => {
    it('matches adult user correctly', () => {
      const data = { type: 'user', name: 'John', age: 30 }

      const result = match(
        data,
        ([name], { when }) => [
          // Match if type is 'user' and age is >= 18
          () => ({ type: 'user', name, age: when(a => a >= 18) }),
          () => `Adult user: ${name}`,
          
          // Match if type is 'user' and age is < 18
          () => ({ type: 'user', name, age: when(a => a < 18) }),
          () => `Minor user: ${name}`,
          
          // Default case
          () => 'Unknown entity',
        ]
      )
      expect(result).toBe('Adult user: John')
    })

    it('matches minor user correctly', () => {
      const data = { type: 'user', name: 'Billy', age: 15 }

      const result = match(
        data,
        ([name], { when }) => [
          // Match if type is 'user' and age is >= 18
          () => ({ type: 'user', name, age: when(a => a >= 18) }),
          () => `Adult user: ${name}`,
          
          // Match if type is 'user' and age is < 18
          () => ({ type: 'user', name, age: when(a => a < 18) }),
          () => `Minor user: ${name}`,
          
          // Default case
          () => 'Unknown entity',
        ]
      )
      expect(result).toBe('Minor user: Billy')
    })
  })

  describe('Or Patterns', () => {
    it('matches one of multiple patterns', () => {
      const result = match(
        [0, 1, 2, 3, 4, 5],
        /* eslint-disable no-empty-pattern */
        ([], { or }) => [
        /* eslint-enable no-empty-pattern */
          () => [0, 1, 2, or(3, 4), 4, 5],
          () => 'Matched: 3 or 4',
        ]
      )
      expect(result).toBe('Matched: 3 or 4')
    })
  })

  describe('Optional Patterns', () => {
    it('matches with optional element present', () => {
      const result = match(
        [0, 1, 1.5, 2],
        ([val1, val2]) => [
          () => [0, 1, val1.optional, val2],
          () => [val1, val2],
        ]
      )
      expect(result).toEqual([1.5, 2])
    })

    it('matches with optional element absent', () => {
      const result = match(
        [0, 1, 2],
        ([val1, val2]) => [
          () => [0, 1, val1.optional, val2],
          () => [val1, val2],
        ]
      )
      expect(result).toEqual([undefined, 2])
    })
  })

  describe('Rest Patterns', () => {
    describe('Array Rest Patterns', () => {
      it('matches elements at the beginning of an array', () => {
        const result = match(
          ['a', 'b', 'c', 'd'],
          ([prefix]) => [
            () => [...prefix, 'c', 'd'],
            () => prefix,
          ]
        )
        expect(result).toEqual(['a', 'b'])
      })

      it('matches elements in the middle of an array', () => {
        const result = match(
          ['a', 'b', 'c', 'd'],
          ([middle]) => [
            () => ['a', ...middle, 'd'],
            () => middle,
          ]
        )
        expect(result).toEqual(['b', 'c'])
      })

      it('matches elements at the end of an array', () => {
        const result = match(
          ['a', 'b', 'c', 'd'],
          ([suffix]) => [
            () => ['a', 'b', ...suffix],
            () => suffix,
          ]
        )
        expect(result).toEqual(['c', 'd'])
      })

      it('captures all elements in an array', () => {
        const result = match(
          ['a', 'b', 'c', 'd'],
          ([all]) => [
            () => [...all],
            () => all,
          ]
        )
        expect(result).toEqual(['a', 'b', 'c', 'd'])
      })
    })

    describe('Object Rest Patterns', () => {
      it('captures remaining properties in an object', () => {
        const data = { id: 1, name: 'John', age: 30, city: 'New York', country: 'USA' }

        const result = match(
          data,
          ([id, rest]) => [
            () => ({ id, ...rest }),
            () => [id, rest],
          ]
        )
        expect(result).toEqual([1, { name: 'John', age: 30, city: 'New York', country: 'USA' }])
      })
    })
  })

  describe('Handling No Matches', () => {
    it('throws NoMatch error when no patterns match', () => {
      expect(() => {
        match(
          [1, 2, 3],
          ([val1]) => [
            () => [1, val1, 5], // This won't match [1, 2, 3]
            () => `Matched: ${val1}`,
          ]
        )
      }).toThrow(NoMatch)
    })

    it('uses default case when no patterns match', () => {
      const result = match(
        [1, 2, 3],
        ([val1]) => [
          // No matches
          () => [1, val1, 4],
          () => [val1],

          // Default case
          () => 'Default result'
        ]
      )
      expect(result).toBe('Default result')
    })
  })
})

describe('Wildcards', () => {
  it('matches specific positions with wildcards', () => {
    const result = match(
      [0, 1, 2, 3, 4, 5, 6, 7],
      ([val], { _ }) => [
        () => [_, _, _, val, _, _, _, _],
        () => `Found at position 3: ${val}`,
      ]
    )
    expect(result).toBe('Found at position 3: 3')
  })

  it('uses wildcards with rest patterns', () => {
    const result = match(
      [0, 1, 2, 3, 4, 5],
      ([val], { _ }) => [
        () => [0, 1, ..._, val, _],
        () => `Value at the end: ${val}`,
      ]
    )
    expect(result).toBe('Value at the end: 4')
  })

  it('uses wildcards in objects', () => {
    const result = match(
      { name: 'John', age: 30, city: 'New York', country: 'USA' },
      ([age], { _ }) => [
        () => ({ name: _, age, city: _, country: 'USA' }),
        () => `Person is ${age} years old`,
      ]
    )
    expect(result).toBe('Person is 30 years old')
  })
})

describe('Anonymous Pattern Matching', () => {
  /* eslint-disable no-empty-pattern */
  it('uses anonymous or patterns', () => {
    const result = match(
      { type: 'user', status: 'active' },
      ([], { or }) => [
        () => ({ type: 'user', status: or('active', 'pending') }),
        () => 'Valid user',
      ]
    )
    expect(result).toBe('Valid user')
  })

  it('uses anonymous ofType patterns', () => {
    const result = match(
      { id: 123, name: 'Product' },
      ([], { _, ofType }) => [
        () => ({ id: ofType('number'), name: _ }),
        () => 'Valid product ID',
      ]
    )
    expect(result).toBe('Valid product ID')
  })

  it('uses anonymous regex patterns', () => {
    const result = match(
      { code: 'ABC-1234', reference: 'REF-5678-XYZ' },
      ([], { regex }) => [
        () => ({ 
          code: regex(/^ABC-\d{4}$/),
          reference: regex(/^REF-\d{4}-[A-Z]{3}$/)
        }),
        () => 'Valid format codes'
      ]
    )
    expect(result).toBe('Valid format codes')
  })

  it('uses anonymous when patterns', () => {
    /* eslint-disable no-empty-pattern */
    const result = match(
      { score: 85, quantity: 5 },
      ([], { when }) => [
        () => ({ 
          score: when(s => s >= 70),
          quantity: when(q => q > 0 && q < 10)
        }),
        () => 'Valid score and quantity'
      ]
    )
    /* eslint-enable no-empty-pattern */
    expect(result).toBe('Valid score and quantity')
  })

  it('combines anonymous patterns', () => {
    /* eslint-disable no-empty-pattern */
    const result = match(
      { 
        data: [1, 2, 3], 
        format: 'array', 
        id: 'PROD-1234', 
        count: 42,
        status: 'enabled'
      },
      ([], { or, ofType, regex, when, not }) => [
        () => ({ 
          data: ofType('array').when(arr => arr.length > 0), 
          format: or('array', 'list'),
          id: regex(/^PROD-\d{4}$/),
          count: when(c => c > 0 && c % 2 === 0),
          status: not('disabled', 'pending')
        }),
        () => 'Valid data format, ID, and count'
      ]
    )
    /* eslint-enable no-empty-pattern */
    expect(result).toBe('Valid data format, ID, and count')
  })
  /* eslint-enable no-empty-pattern */
})

describe('Regex Pattern Matching', () => {
  it('matches using regex with string values', () => {
    const result = match(
      { id: 'user-123', email: 'john@example.com' },
      ([id, email]) => [
        () => ({ 
          id: id.regex(/^user-\d+$/),
          email: email.regex(/@example\.com$/)
        }),
        () => `Valid user: ${id} with email ${email}`
      ]
    )
    expect(result).toBe('Valid user: user-123 with email john@example.com')
  })

  it('matches specific format in arrays', () => {
    const result = match(
      ['SKU-1234', 'SKU-5678', 'ITEM-9012'],
      ([skuCode], { _ }) => [
        () => [skuCode.regex(/^SKU-\d{4}$/), ..._, _],
        () => `Found SKU code: ${skuCode}`
      ]
    )
    expect(result).toBe('Found SKU code: SKU-1234')
  })
})

describe('Type Checking with ofType', () => {
  it('matches primitives by type', () => {
    const result = match(
      { id: 123, name: 'Product', inStock: true },
      ([id, name, stock]) => [
        () => ({ 
          id: id.ofType('number'), 
          name: name.ofType('string'),
          inStock: stock.ofType('boolean')
        }),
        () => `Product ${name} (ID: ${id}) is ${stock ? 'in stock' : 'out of stock'}`
      ]
    )
    expect(result).toBe('Product Product (ID: 123) is in stock')
  })

  it('matches all typeof strings and special array type', () => {
    /* eslint-disable no-empty-pattern */
    // Create values of all possible types
    const testValues = {
      string: 'hello',
      number: 42,
      boolean: true,
      object: { key: 'value' },
      array: [1, 2, 3],
      function: function() {},
      undefined: undefined,
      symbol: Symbol('test'),
      bigint: BigInt(123)
    }
    
    // Test each type individually
    Object.entries(testValues).forEach(([type, value]) => {
      const typeName = type === 'array' ? 'array' : typeof value
      const result = match(
        value,
        ([], { ofType }) => [
          () => ofType(typeName),
          () => `Matched ${typeName}`
        ]
      )
      expect(result).toBe(`Matched ${typeName}`)
    })
    /* eslint-enable no-empty-pattern */
  })

  it('uses anonymous type checking with updated array example', () => {
    /* eslint-disable no-empty-pattern */
    const result = match(
      [42, 'hello', true, { key: 'value' }, [1, 2, 3]],
      ([], { ofType }) => [
        () => [
          ofType('number'),
          ofType('string'),
          ofType('boolean'),
          ofType('object'),
          ofType('array')  // Special type check specifically for arrays
        ],
        () => 'Array contains expected types'
      ]
    )
    /* eslint-enable no-empty-pattern */
    expect(result).toBe('Array contains expected types')
  })

  it('uses array specific type check with data', () => {
    const result = match(
      { data: [1, 2, 3], config: { enabled: true } },
      ([data, config]) => [
        () => ({ 
          data: data.ofType('array').when(arr => arr.length > 0),
          config: config.ofType('object').when(obj => obj.enabled)
        }),
        () => 'Valid configuration with data'
      ]
    )
    expect(result).toBe('Valid configuration with data')
  })

  it('uses anonymous type checking', () => {
    /* eslint-disable no-empty-pattern */
    const result = match(
      [42, 'hello', true, { key: 'value' }],
      ([], { ofType }) => [
        () => [
          ofType('number'),
          ofType('string'),
          ofType('boolean'),
          ofType('object')
        ],
        () => 'Array contains expected types'
      ]
    )
    /* eslint-enable no-empty-pattern */
    expect(result).toBe('Array contains expected types')
  })

  it('matches against class instances', () => {
    const testDate = new Date('2023-01-01')
    const testSet = new Set([1, 2, 3])
    const testMap = new Map([['version', '1.0']])
    
    const result = match(
      { 
        createdAt: testDate, 
        items: testSet,
        metadata: testMap
      },
      ([date, items, meta]) => [
        () => ({ 
          createdAt: date.ofType(Date),
          items: items.ofType(Set),
          metadata: meta.ofType(Map)
        }),
        () => `Created on ${date.toLocaleDateString()} with ${items.size} items`
      ]
    )
    
    // Note: The exact format of the date might vary by environment, so we'll test for inclusion
    expect(result).toContain('Created on')
    expect(result).toContain('with 3 items')
  })

  it('uses anonymous class matching', () => {
    /* eslint-disable no-empty-pattern */
    const testError = new Error('Test error')
    const testPromise = new Promise(() => {})
    const testDate = new Date()
    
    const result = match(
      [testError, testPromise, testDate],
      ([], { ofType }) => [
        () => [
          ofType(Error),
          ofType(Promise),
          ofType(Date)
        ],
        () => 'Array contains expected class instances'
      ]
    )
    /* eslint-enable no-empty-pattern */
    expect(result).toBe('Array contains expected class instances')
  })

  it('combines ofType with other patterns', () => {
    const result = match(
      { data: [1, 2, 3], config: { enabled: true } },
      ([data, config]) => [
        () => ({ 
          data: data.ofType('object').when(arr => arr.length > 0),
          config: config.ofType('object').when(obj => obj.enabled)
        }),
        () => 'Valid configuration with data'
      ]
    )
    expect(result).toBe('Valid configuration with data')
  })
})

describe('Real-World Examples', () => {
  describe('API Response Processing', () => {
    // Helper function for transformation
    const transformItem = (item) => ({ ...item, transformed: true })

    // Implementation from README
    function processApiResponse(response) {
      return match(
        response,
        ([status, data, error, code, message]) => [ // eslint-disable-line no-unused-vars
          // Success case with array data
          () => ({ 
            status: 'success', 
            data: data.ofType('array') 
          }),
          () => data.map(item => transformItem(item)),
          
          // Success case with single object data
          () => ({ 
            status: 'success', 
            data: data.ofType('object') 
          }),
          () => transformItem(data),
          
          // Client error case
          () => ({ 
            status: 'error', 
            error: { 
              code: code.when(c => c >= 400 && c < 500), 
              message 
            } 
          }),
          () => ({ error: `Client error: ${message}` }),
          
          // Server error case
          () => ({ 
            status: 'error', 
            error: { 
              code: code.when(c => c >= 500), 
              message 
            } 
          }),
          () => ({ error: `Server error: ${message}` }),
          
          // Default error case
          () => ({ error: 'Invalid response or unknown error' })
        ]
      )
    }

    it('processes success response with array data', () => {
      const response = {
        status: 'success',
        data: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }]
      }
      
      const result = processApiResponse(response)
      expect(result).toEqual([
        { id: 1, name: 'Item 1', transformed: true },
        { id: 2, name: 'Item 2', transformed: true }
      ])
    })

    it('processes success response with object data', () => {
      const response = {
        status: 'success',
        data: { id: 1, name: 'Single Item' }
      }
      
      const result = processApiResponse(response)
      expect(result).toEqual({ 
        id: 1, 
        name: 'Single Item', 
        transformed: true 
      })
    })

    it('processes client error response', () => {
      const response = {
        status: 'error',
        error: {
          code: 404,
          message: 'Resource not found'
        }
      }
      
      const result = processApiResponse(response)
      expect(result).toEqual({ 
        error: 'Client error: Resource not found' 
      })
    })

    it('processes server error response', () => {
      const response = {
        status: 'error',
        error: {
          code: 500,
          message: 'Internal server error'
        }
      }
      
      const result = processApiResponse(response)
      expect(result).toEqual({ 
        error: 'Server error: Internal server error' 
      })
    })

    it('handles invalid response with default case', () => {
      const response = {
        status: 'unknown'
      }
      
      const result = processApiResponse(response)
      expect(result).toEqual({ 
        error: 'Invalid response or unknown error' 
      })
    })
  })

  describe('AST Evaluation', () => {
    // Implementation from README
    function evaluate(node, context = {}) {
      return match(
        node,
        ([type, operator, left, right, argument, value, name]) => [ // eslint-disable-line no-unused-vars
          // Binary expressions
          () => ({ 
            type: 'BinaryExpression', 
            operator: '+', 
            left, 
            right 
          }),
          () => evaluate(left, context) + evaluate(right, context),
          
          () => ({ 
            type: 'BinaryExpression', 
            operator: '-', 
            left, 
            right 
          }),
          () => evaluate(left, context) - evaluate(right, context),
          
          () => ({ 
            type: 'BinaryExpression', 
            operator: '*', 
            left, 
            right 
          }),
          () => evaluate(left, context) * evaluate(right, context),
          
          () => ({ 
            type: 'BinaryExpression', 
            operator: '/', 
            left, 
            right 
          }),
          () => evaluate(left, context) / evaluate(right, context),
          
          // Unary expressions
          () => ({ 
            type: 'UnaryExpression', 
            operator: '-', 
            argument 
          }),
          () => -evaluate(argument, context),
          
          () => ({ 
            type: 'UnaryExpression', 
            operator: '+', 
            argument 
          }),
          () => +evaluate(argument, context),
          
          () => ({ 
            type: 'UnaryExpression', 
            operator: '!', 
            argument 
          }),
          () => !evaluate(argument, context),
          
          // Literals and identifiers
          () => ({ type: 'Literal', value }),
          () => value,
          
          () => ({ type: 'Identifier', name }),
          () => context[name] || 0,
          
          // Default case
          () => null
        ]
      )
    }

    it('evaluates literal values', () => {
      const node = { type: 'Literal', value: 42 }
      expect(evaluate(node)).toBe(42)
    })

    it('evaluates identifiers using context', () => {
      const node = { type: 'Identifier', name: 'x' }
      const context = { x: 10 }
      expect(evaluate(node, context)).toBe(10)
    })

    it('evaluates addition operation', () => {
      const node = {
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'Literal', value: 5 },
        right: { type: 'Literal', value: 3 }
      }
      expect(evaluate(node)).toBe(8)
    })

    it('evaluates subtraction operation', () => {
      const node = {
        type: 'BinaryExpression',
        operator: '-',
        left: { type: 'Literal', value: 10 },
        right: { type: 'Literal', value: 4 }
      }
      expect(evaluate(node)).toBe(6)
    })

    it('evaluates multiplication operation', () => {
      const node = {
        type: 'BinaryExpression',
        operator: '*',
        left: { type: 'Literal', value: 6 },
        right: { type: 'Literal', value: 7 }
      }
      expect(evaluate(node)).toBe(42)
    })

    it('evaluates division operation', () => {
      const node = {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'Literal', value: 20 },
        right: { type: 'Literal', value: 5 }
      }
      expect(evaluate(node)).toBe(4)
    })

    it('evaluates unary negative operation', () => {
      const node = {
        type: 'UnaryExpression',
        operator: '-',
        argument: { type: 'Literal', value: 7 }
      }
      expect(evaluate(node)).toBe(-7)
    })

    it('evaluates complex nested expressions', () => {
      // Equivalent to: (3 * (10 - 4)) + 2
      const node = {
        type: 'BinaryExpression',
        operator: '+',
        left: {
          type: 'BinaryExpression',
          operator: '*',
          left: { type: 'Literal', value: 3 },
          right: {
            type: 'BinaryExpression',
            operator: '-',
            left: { type: 'Literal', value: 10 },
            right: { type: 'Literal', value: 4 }
          }
        },
        right: { type: 'Literal', value: 2 }
      }
      expect(evaluate(node)).toBe(20) // (3 * 6) + 2 = 20
    })
  })
})

describe('Not Patterns', () => {
  it('matches when notPatterns do not match', () => {
    const result = match(
      { type: 'admin', permissions: ['read', 'write', 'delete'] },
      ([type, permissions]) => [
        () => ({ 
          type: type.not('user', 'guest'),
          permissions 
        }),
        () => `Special type with ${permissions.length} permissions`
      ]
    )
    expect(result).toBe('Special type with 3 permissions')
  })

  it('fails when a notPattern matches', () => {
    const result = match(
      { type: 'user', role: 'editor' },
      ([type, role]) => [
        // This won't match because type IS 'user'
        () => ({ 
          type: type.not('user', 'guest'),
          role 
        }),
        () => 'This won\'t be returned',
        
        // Fallback for regular users
        () => ({ type: 'user', role }),
        () => `Regular user with ${role} role`
      ]
    )
    expect(result).toBe('Regular user with editor role')
  })

  it('uses anonymous not patterns', () => {
    /* eslint-disable no-empty-pattern */
    const result = match(
      { status: 'active', level: 5 },
      ([], { not }) => [
        () => ({ 
          status: not('pending', 'suspended', 'inactive'),
          level: not(1, 2, 3) 
        }),
        () => 'Advanced active account'
      ]
    )
    /* eslint-enable no-empty-pattern */
    expect(result).toBe('Advanced active account')
  })

  it('combines not with other patterns', () => {
    const result = match(
      { id: 'premium-123', type: 'subscription', active: true },
      ([id, type, active]) => [
        () => ({ 
          id: id.regex(/^premium-\d+$/).not(id.regex(/^premium-0+$/)),
          type: type.not('trial', 'free'),
          active // Simple boolean check
        }),
        () => 'Valid premium subscription'
      ]
    )
    expect(result).toBe('Valid premium subscription')
  })
}) 