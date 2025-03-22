# MatchFun

A powerful pattern matching library for JavaScript that provides declarative, functional pattern matching capabilities.

## Installation

```bash
npm install matchfun
# or
yarn add matchfun
```

## Overview

MatchFun is a JavaScript library that enables pattern matching similar to languages like Haskell, OCaml, or Rust. It allows you to match complex data structures against patterns and extract values based on those matches.

Key features:
- Match against arrays, objects, and primitive values
- Match variables (mvars) for binding values
- Guards and predicates to restrict matches
- "Or" patterns to match multiple possibilities
- Optional pattern components
- Rest operators for array and object matching

## Usage

### Basic Matching

```javascript
import { match } from 'matchfun';

// Match an array and extract values
const result = match(
  [{ x: 1, y: { a: '2' }, z: { b: false } }],
  ([val1, val2, val3]) => [
    () => [{ x: val1, y: val2, z: { b: val3 } }],
    () => [val1, val2, val3],
  ]
);
// result: [1, { a: '2' }, false]
```

### Alternative Syntaxes

MatchFun supports two different syntaxes for defining patterns and results:

#### 1. Enclosing Function Syntax (Recommended)

The first syntax uses an enclosing function as the second argument to `match`. This function receives mvars as its first parameter and should return an array of pattern and result functions:

```javascript
import { match } from 'matchfun';

const result = match(
  { type: 'user', name: 'John', age: 30 },
  ([name], { when }) => [  // Only extract values you need
    // Pattern function
    () => ({ type: 'user', name, age: when(a => a >= 18) }),
    // Result function
    () => `Adult user: ${name}`,
    
    // Another pattern
    () => ({ type: 'user', name, age: when(a => a < 18) }),
    // Result for second pattern
    () => `Minor user: ${name}`,
  ]
);
// result: 'Adult user: John'
```

This syntax is more concise and provides direct access to the mvars within both pattern and result functions. It's the recommended approach for most use cases.

#### 2. Direct Array Syntax (for Composability)

The second syntax lets you pass an array of functions directly as the second argument to `match`. This syntax enables composability and reuse of patterns across different `match` invocations:

```javascript
import { match } from 'matchfun';

// Reusable pattern/result pairs
const adultUserPatterns = [
  ([name], { when }) => ({ type: 'user', name, age: when(a => a >= 18) }),
  ([name]) => `Adult user: ${name}`,
];

const minorUserPatterns = [
  ([name], { when }) => ({ type: 'user', name, age: when(a => a < 18) }),
  ([name]) => `Minor user: ${name}`,
];

// Combine patterns for complete user matching
const allUserPatterns = [...adultUserPatterns, ...minorUserPatterns];

// Use specific pattern set
const adultResult = match(
  { type: 'user', name: 'John', age: 30 },
  adultUserPatterns
);
// adultResult: 'Adult user: John'

// Use combined patterns
const result = match(
  { type: 'user', name: 'Billy', age: 15 },
  allUserPatterns
);
// result: 'Minor user: Billy'
```

This syntax makes it easy to define, combine, and reuse pattern/result pairs across your application. You can create libraries of patterns for common data structures and compose them as needed for different matching scenarios.

Note that each function in the array receives the same set of mvar parameters, allowing you to access them directly in both the pattern and result functions.

### Pattern Matching with Guards

```javascript
import { match } from 'matchfun';

const data = { type: 'user', name: 'John', age: 30 };

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
);
// result: 'Adult user: John'
```

### "Or" Patterns

```javascript
import { match } from 'matchfun';

const result = match(
  [0, 1, 2, 3, 4, 5],
  ([], { or }) => [
    () => [0, 1, 2, or(3, 4), 4, 5],
    () => `Matched: 3 or 4`,
  ]
);
// result: 'Matched: 3 or 4'
```

### "Not" Patterns

The `not()` pattern method allows you to specify patterns that should not match the input. It succeeds only when all of the provided patterns fail to match:

```javascript
import { match } from 'matchfun';

// Match any type except 'user' or 'guest'
const result1 = match(
  { type: 'admin', permissions: ['read', 'write', 'delete'] },
  ([], { ofType, not }) => [
    () => ({ 
      type: not('user', 'guest'),
      permissions: ofType('array').not([]) // Ensure permissions array is not empty
    }),
    () => `Special type with permissions`
  ]
);
// result1: 'Special type with permissions'

// Using negation in a series of patterns
const result2 = match(
  { type: 'user', role: 'editor' },
  ([], { not }) => [
    // This won't match because type IS 'user'
    () => ({ 
      type: not('user', 'guest'),
      role 
    }),
    () => 'Non-standard user',
    
    // Fallback for regular users
    () => ({ type: 'user' }),
    () => `Regular user with editor role`
  ]
);
// result2: 'Regular user with editor role'

// Using anonymous not patterns
const result3 = match(
  { status: 'active', level: 5 },
  ([], { not }) => [
    () => ({ 
      status: not('pending', 'suspended', 'inactive'),
      level: not(1, 2, 3) 
    }),
    () => 'Advanced active account'
  ]
);
// result3: 'Advanced active account'

// Combining not with other patterns
const result4 = match(
  { id: 'premium-123', type: 'subscription', active: true },
  ([], { regex, not, when }) => [
    () => ({ 
      id: regex(/^premium-\d+$/).not(regex(/^premium-0+$/)),
      type: not('trial', 'free'),
      active // Simple boolean check
    }),
    () => 'Valid premium subscription'
  ]
);
// result4: 'Valid premium subscription'
```

Not patterns are useful for:
- Excluding specific values or patterns
- Creating "everything except" conditions
- Defining negative constraints on matches
- Building complex logical conditions with NOT semantics

### Optional Patterns

Optional patterns can only occur in array patterns and must be used with named mvars:

```javascript
import { match } from 'matchfun';

// Will match both with and without the optional element
const result = match(
  [0, 1, 2],
  ([val1, val2]) => [
    () => [0, 1, val1.optional, val2],
    () => [val1, val2],
  ]
);
// result: [undefined, 2]

// With the optional element present
const resultWithOptional = match(
  [0, 1, 1.5, 2],
  ([val1, val2]) => [
    () => [0, 1, val1.optional, val2],
    () => [val1, val2],
  ]
);
// resultWithOptional: [1.5, 2]
```

### Rest Patterns

MatchFun supports rest patterns for both arrays and objects, allowing you to capture multiple elements or properties in a single match variable.

#### Array Rest Patterns

Use the spread operator (`...`) to match zero or more elements in an array:

```javascript
import { match } from 'matchfun';

// Match elements at the beginning of an array
const result1 = match(
  ['a', 'b', 'c', 'd'],
  ([prefix]) => [
    () => [...prefix, 'c', 'd'],
    () => prefix,
  ]
);
// result1: ['a', 'b']

// Match elements in the middle of an array
const result2 = match(
  ['a', 'b', 'c', 'd'],
  ([], { _ }) => [
    () => ['a', ..._, 'd'],
    () => 'Matched middle elements'
  ]
);
// result2: 'Matched middle elements'

// Match elements at the end of an array
const result3 = match(
  ['a', 'b', 'c', 'd'],
  ([suffix]) => [
    () => ['a', 'b', ...suffix],
    () => suffix,
  ]
);
// result3: ['c', 'd']
```

#### Object Rest Patterns

Use the spread operator (`...`) to capture remaining properties in an object:

```javascript
import { match } from 'matchfun';

const data = { id: 1, name: 'John', age: 30, city: 'New York', country: 'USA' };

// Capture id and the remaining properties
const result = match(
  data,
  ([rest]) => [
    () => ({ id: 1, ...rest }),
    () => rest,
  ]
);
// result: { name: 'John', age: 30, city: 'New York', country: 'USA' }
```

Object rest patterns are useful for:
- Extracting specific properties while gathering all others
- Pattern matching on a subset of properties
- Implementing pick and omit functionality
- Destructuring complex objects

Like with arrays, only one rest pattern is allowed per object.

### Handling No Matches

By default, the `match` function will throw a `NoMatch` error if none of the patterns match the input:

```javascript
import { match, NoMatch } from 'matchfun';

// Will throw a NoMatch error
try {
  match(
    [1, 2, 3],
    ([], { when }) => [
      () => [1, when(x => x > 5), 3], // This won't match [1, 2, 3]
      () => 'Matched',
    ]
  );
} catch (error) {
  if (error instanceof NoMatch) {
    console.error('No pattern matched the input data');
  }
}
```

To avoid this error, you can provide a default case by adding a pattern function without a corresponding result function:

```javascript
import { match } from 'matchfun';

const result = match(
  [1, 2, 3],
  ([], { when }) => [
    // No matches
    () => [1, when(x => x > 5), 3],
    () => 'Will not match',

    // Default case
    () => 'Default result'
  ]
);
// result: 'Default result'
```

### Wildcards

Wildcards (`_`) match any value without binding it to a variable. They're useful when you need to match a pattern but don't care about specific values:

```javascript
import { match } from 'matchfun';

// Match a specific position in an array
const result1 = match(
  [0, 1, 2, 3, 4, 5, 6, 7],
  ([val], { _ }) => [
    () => [_, _, _, val, _, _, _, _],
    () => `Found at position 3: ${val}`,
  ]
);
// result1: 'Found at position 3: 3'

// Use wildcards with rest patterns in an array
const result2 = match(
  [0, 1, 2, 3, 4, 5],
  ([val], { _ }) => [
    () => [0, 1, ..._, val, _],
    () => `Value at the end: ${val}`,
  ]
);
// result2: 'Value at the end: 4'

// Use wildcards in objects to match properties you don't care about
const result3 = match(
  { name: 'John', age: 30, city: 'New York', country: 'USA' },
  ([], { _ }) => [
    () => ({ name: _, age: 30, city: _, country: 'USA' }),
    () => 'Person is 30 years old from USA',
  ]
);
// result3: 'Person is 30 years old from USA'
```

### Anonymous Pattern Matching

MatchFun provides anonymous pattern functions that allow you to perform pattern matching without creating named match variables:

```javascript
import { match } from 'matchfun';

// Anonymous "or" pattern
const result1 = match(
  { type: 'user', status: 'active' },
  ([], { or }) => [
    () => ({ type: 'user', status: or('active', 'pending') }),
    () => 'Valid user',
  ]
);
// result1: 'Valid user'

// Anonymous type checking
const result2 = match(
  { id: 123, name: 'Product' },
  ([], { ofType }) => [
    () => ({ id: ofType('number'), name: ofType('string') }),
    () => 'Valid product entry',
  ]
);
// result2: 'Valid product entry'

// Anonymous regex pattern
const result3 = match(
  { code: 'ABC-1234', reference: 'REF-5678-XYZ' },
  ([], { regex }) => [
    () => ({ 
      code: regex(/^ABC-\d{4}$/),
      reference: regex(/^REF-\d{4}-[A-Z]{3}$/)
    }),
    () => 'Valid format codes'
  ]
);
// result3: 'Valid format codes'

// Anonymous when pattern
const result4 = match(
  { score: 85, quantity: 5 },
  ([], { when }) => [
    () => ({ 
      score: when(s => s >= 70),
      quantity: when(q => q > 0 && q < 10)
    }),
    () => 'Valid score and quantity'
  ]
);
// result4: 'Valid score and quantity'

// Anonymous not pattern
const result5 = match(
  { level: 'advanced', category: 'premium' },
  ([], { not }) => [
    () => ({
      level: not('beginner', 'intermediate'),
      category: not('free', 'basic')
    }),
    () => 'Advanced premium content'
  ]
);
// result5: 'Advanced premium content'

// Combining anonymous patterns
const result6 = match(
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
    () => 'Valid data entry'
  ]
);
// result6: 'Valid data entry'
```

Anonymous pattern matching is useful when you need to match against specific conditions but don't need to extract values from the input.

### Regex Pattern Matching

You can use the `regex()` pattern method to match string values against regular expressions:

```javascript
import { match } from 'matchfun';

// Match string values using regex
const result1 = match(
  { id: 'user-123', email: 'john@example.com' },
  ([], { regex }) => [
    () => ({ 
      id: regex(/^user-\d+$/),
      email: regex(/@example\.com$/)
    }),
    () => 'Valid user credentials'
  ]
);
// result1: 'Valid user credentials'

// Match specific formats in arrays
const result2 = match(
  ['SKU-1234', 'SKU-5678', 'ITEM-9012'],
  ([], { regex, _ }) => [
    () => [regex(/^SKU-\d{4}$/), _, _],
    () => 'Found SKU code in first position'
  ]
);
// result2: 'Found SKU code in first position'
```

### Type Checking with ofType

The `ofType()` pattern method lets you match values by their JavaScript type:

```javascript
import { match } from 'matchfun';

// Match primitive types
const result1 = match(
  { id: 123, name: 'Product', inStock: true },
  ([], { ofType }) => [
    () => ({ 
      id: ofType('number'), 
      name: ofType('string'),
      inStock: ofType('boolean')
    }),
    () => 'Product has valid type structure'
  ]
);
// result1: 'Product has valid type structure'

// Match against arrays (special type)
const result2 = match(
  { data: [1, 2, 3], config: { enabled: true } },
  ([], { ofType, when }) => [
    () => ({ 
      data: ofType('array').when(arr => arr.length > 0),
      config: ofType('object').when(obj => obj.enabled)
    }),
    () => 'Valid configuration with data'
  ]
);
// result2: 'Valid configuration with data'

// Match against class instances
const result3 = match(
  { 
    createdAt: new Date('2023-01-01'), 
    items: new Set([1, 2, 3]),
    metadata: new Map([['version', '1.0']])
  },
  ([], { ofType }) => [
    () => ({ 
      createdAt: ofType(Date),
      items: ofType(Set),
      metadata: ofType(Map)
    }),
    () => 'Valid object with proper class instances'
  ]
);
// result3: 'Valid object with proper class instances'
```

The `ofType` method supports:
- JavaScript primitive types: 'string', 'number', 'boolean', 'object', 'undefined', 'symbol', 'bigint', 'function'
- Special 'array' type check for arrays
- Class constructor checks (e.g., Date, Map, Set, Error, Promise, or your custom classes)

## Practical Examples

Let's explore some practical examples where pattern matching significantly improves code readability and maintainability compared to traditional approaches.

### Example 1: Parsing and Processing API Responses

Without pattern matching, handling different API response structures can lead to deeply nested conditionals:

```javascript
function processApiResponse(response) {
  if (response.status === 'success') {
    if (response.data) {
      if (Array.isArray(response.data)) {
        return response.data.map(item => transformItem(item));
      } else if (typeof response.data === 'object') {
        return transformItem(response.data);
      } else {
        return { error: 'Unexpected data format' };
      }
    } else {
      return { error: 'No data in success response' };
    }
  } else if (response.status === 'error') {
    if (response.error && response.error.code) {
      if (response.error.code >= 400 && response.error.code < 500) {
        return { error: `Client error: ${response.error.message}` };
      } else if (response.error.code >= 500) {
        return { error: `Server error: ${response.error.message}` };
      } else {
        return { error: `Unknown error: ${response.error.message}` };
      }
    } else {
      return { error: 'Unknown error' };
    }
  } else {
    return { error: 'Invalid response status' };
  }
}
```

With pattern matching, the code becomes much more declarative and easier to read:

```javascript
import { match } from 'matchfun';

function processApiResponse(response) {
  return match(
    response,
    ([status, data, error, code, message]) => [
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
  );
}
```

### Example 2: State Machine for UI Components

Managing component state with traditional logic:

```javascript
class FormComponent {
  constructor() {
    this.state = { status: 'initial', data: null, error: null };
  }
  
  renderContent() {
    const { status, data, error, validationErrors } = this.state;
    
    if (status === 'loading') {
      return this.renderLoading();
    } else if (status === 'error') {
      return this.renderError(error);
    } else if (status === 'success') {
      if (data) {
        return this.renderSuccess(data);
      } else {
        return this.renderEmpty();
      }
    } else if (status === 'validation_error') {
      return this.renderValidationErrors(validationErrors);
    } else {
      return this.renderInitial();
    }
  }
  
  // Render methods for each state...
}
```

With pattern matching, state transitions and rendering logic become more declarative:

```javascript
import { match } from 'matchfun';

class FormComponent {
  constructor() {
    this.state = { status: 'initial', data: null, error: null };
  }
  
  renderContent() {
    return match(
      this.state,
      ([status, data, error, validationErrors]) => [
        () => ({ status: 'loading' }),
        () => this.renderLoading(),
        
        () => ({ status: 'error', error }),
        () => this.renderError(error),
        
        () => ({ status: 'success', data: data.when(Boolean) }),
        () => this.renderSuccess(data),
        
        () => ({ status: 'success', data: data.when(d => !d) }),
        () => this.renderEmpty(),
        
        () => ({ status: 'validation_error', validationErrors }),
        () => this.renderValidationErrors(validationErrors),
        
        // Default case (initial)
        () => this.renderInitial()
      ]
    );
  }
  
  // Render methods for each state...
}
```

### Example 3: Parsing Abstract Syntax Trees

Consider parsing a simple expression AST without pattern matching:

```javascript
function evaluate(node) {
  if (!node) return null;
  
  if (node.type === 'BinaryExpression') {
    const left = evaluate(node.left);
    const right = evaluate(node.right);
    
    if (node.operator === '+') {
      return left + right;
    } else if (node.operator === '-') {
      return left - right;
    } else if (node.operator === '*') {
      return left * right;
    } else if (node.operator === '/') {
      return left / right;
    }
  } else if (node.type === 'UnaryExpression') {
    const argument = evaluate(node.argument);
    
    if (node.operator === '-') {
      return -argument;
    } else if (node.operator === '+') {
      return +argument;
    } else if (node.operator === '!') {
      return !argument;
    }
  } else if (node.type === 'Literal') {
    return node.value;
  } else if (node.type === 'Identifier') {
    return context[node.name] || 0; // Assuming a context object in scope
  }
  
  return null;
}
```

With pattern matching, the AST evaluation becomes much more declarative:

```javascript
import { match } from 'matchfun';

function evaluate(node, context = {}) {
  return match(
    node,
    ([type, operator, left, right, argument, value, name]) => [
      // Binary expressions
      () => ({ type: 'BinaryExpression', operator: '+', left, right }),
      () => evaluate(left, context) + evaluate(right, context),
      
      () => ({ type: 'BinaryExpression', operator: '-', left, right }),
      () => evaluate(left, context) - evaluate(right, context),
      
      () => ({ type: 'BinaryExpression', operator: '*', left, right }),
      () => evaluate(left, context) * evaluate(right, context),
      
      () => ({ type: 'BinaryExpression', operator: '/', left, right }),
      () => evaluate(left, context) / evaluate(right, context),
      
      // Unary expressions
      () => ({ type: 'UnaryExpression', operator: '-', argument }),
      () => -evaluate(argument, context),
      
      () => ({ type: 'UnaryExpression', operator: '+', argument }),
      () => +evaluate(argument, context),
      
      () => ({ type: 'UnaryExpression', operator: '!', argument }),
      () => !evaluate(argument, context),
      
      // Literals and identifiers
      () => ({ type: 'Literal', value }),
      () => value,
      
      () => ({ type: 'Identifier', name }),
      () => context[name] || 0,
      
      // Default case
      () => null
    ]
  );
}
```

### Example 4: Event Handling in Game Development

Traditional event processing in a game loop:

```javascript
function processEvent(event) {
  if (event.type === 'COLLISION') {
    if (event.entity.type === 'PLAYER' && event.target.type === 'ENEMY') {
      if (event.entity.state === 'INVULNERABLE') {
        return; // No damage taken
      } else {
        decreasePlayerHealth(event.entity, event.target.damageAmount);
      }
    } else if (event.entity.type === 'PLAYER' && event.target.type === 'POWERUP') {
      applyPowerup(event.entity, event.target.powerupType);
      removeEntity(event.target);
    } else if (event.entity.type === 'PROJECTILE' && event.target.type === 'ENEMY') {
      damageEnemy(event.target, event.entity.damage);
      removeEntity(event.entity);
    }
  } else if (event.type === 'INPUT') {
    if (event.key === 'SPACE') {
      if (player.state === 'GROUNDED') {
        player.jump();
      } else if (player.state === 'AIRBORNE' && player.canDoubleJump) {
        player.doubleJump();
      }
    } else if (event.key === 'ARROW_LEFT') {
      player.moveLeft();
    } else if (event.key === 'ARROW_RIGHT') {
      player.moveRight();
    }
  }
}
```

Using pattern matching for clearer event handling:

```javascript
import { match } from 'matchfun';

function processEvent(event) {
  match(
    event,
    ([entity, target, entityState, damageAmount, powerupType, damage, canDoubleJump]) => [
      // Player collides with enemy while vulnerable
      () => ({ 
        type: 'COLLISION',
        entity: { type: 'PLAYER', state: entityState.not('INVULNERABLE') },
        target: { type: 'ENEMY', damageAmount }
      }),
      () => decreasePlayerHealth(entity, damageAmount),
      
      // Player collides with powerup
      () => ({ 
        type: 'COLLISION',
        entity: { type: 'PLAYER' },
        target: { type: 'POWERUP', powerupType }
      }),
      () => {
        applyPowerup(entity, powerupType);
        removeEntity(target);
      },
      
      // Projectile hits enemy
      () => ({ 
        type: 'COLLISION',
        entity: { type: 'PROJECTILE', damage },
        target: { type: 'ENEMY' }
      }),
      () => {
        damageEnemy(target, damage);
        removeEntity(entity);
      },
      
      // Space key pressed while grounded
      () => ({ 
        type: 'INPUT',
        key: 'SPACE',
        player: { state: 'GROUNDED' }
      }),
      () => player.jump(),
      
      // Space key pressed while airborne and can double jump
      () => ({ 
        type: 'INPUT',
        key: 'SPACE',
        player: { state: 'AIRBORNE', canDoubleJump }
      }),
      () => player.doubleJump(),
      
      // Arrow key inputs
      () => ({ type: 'INPUT', key: 'ARROW_LEFT' }),
      () => player.moveLeft(),
      
      () => ({ type: 'INPUT', key: 'ARROW_RIGHT' }),
      () => player.moveRight(),
      
      // Ignore other events
      () => {}
    ]
  );
}
```
These examples demonstrate how pattern matching transforms complex, nested conditional logic into more declarative, maintainable code that clearly expresses the intent and structure of the data being processed.

## License

MIT 

## TODO

### Pattern Matching on Object Keys

In a future version, we plan to add the ability for mvars to be used as object pattern keys. This would allow matching based on the keys themselves, not just the values:

```javascript
// Conceptual example - not yet implemented
import { match } from 'matchfun';

const users = {
  'user_123': { name: 'John', role: 'admin' },
  'user_456': { name: 'Alice', role: 'user' },
  'admin_789': { name: 'Bob', role: 'admin' }
};

const result = match(
  users,
  ([keyPattern, userData]) => [
    // Match all keys starting with 'admin_'
    () => ({ [keyPattern.when(k => k.startsWith('admin_'))]: userData }),
    () => `Found admin key: ${keyPattern} for user ${userData.name}`
  ]
);
// Would return information about admin_789
```

This feature is still under consideration as there are several design challenges:
- Multiple keys could potentially match a pattern, requiring the result to be a collection
- The API would need to handle cases where 0, 1, or N keys match the pattern
- We need to determine the most intuitive way to express collections of matches

We welcome feedback and suggestions on this planned feature.