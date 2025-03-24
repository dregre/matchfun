import * as Sym from './sym'

export function match(input, expressions) {
    const matched = tryMatch(input, expressions)
    if (!matched) return

    const { bindings, caseIdx, resultIdx } = matched

    const result = get(get(partitionExpressions(expressions, bindings, {}), caseIdx), resultIdx)
    return result(bindings)
}

export class Var {
    constructor(options) {
        this[Sym.SET_CONFIG](options)
        this[Sym.OBJECT_REST_REF] = new WeakRef(this)

        this[this[Sym.SYMBOL]] = true
    }

    [Sym.SET_CONFIG]({ type, emit }) {
        this[Sym.CONFIG] = {
            emit,
            type,
            ownSymbol: Symbol(),
            operations: [],
        }
    }

    *[Symbol.iterator]() {
        yield new MVarArrayRest(this)
    }

    get [Sym.EMIT]() {
        return this[Sym.CONFIG].emit
    }

    get [Sym.SYMBOL]() {
        return this[Sym.CONFIG].ownSymbol
    }

    get [Sym.MVAR]() {
        return this[Sym.CONFIG].mvar ?? this
    }

    get [Sym.OPERATIONS]() {
        return this[Sym.CONFIG].operations ?? []
    }

    toString() {
        return this[Sym.SYMBOL]
    }
}

class MVar extends Var {
    when(...predicates) {
        return new DerivedMVar({
            base: this, type: 'when',
            operations: [(input) => when(input, predicates)]
        })
    }

    then(...xforms) {
        return new DerivedMVar({
            base: this, type: 'then',
            operations: [(input) => then(input, xforms)]
        })
    }

    not(...notPatterns) {
        return new DerivedMVar({
            base: this, type: 'not',
            operations: [(input, mvarsAndWildcard) => not(input, notPatterns, mvarsAndWildcard)]
        })
    }

    or(...orPatterns) {
        return new DerivedMVar({
            base: this, orPatterns, type: 'or',
            operations: [(input, mvarsAndWildcard) => or(input, orPatterns, mvarsAndWildcard)]
        })
    }

    get optional() {
        return new DerivedMVar({ base: this, type: 'optional', optional: true })
    }

    ofType(t) {
        return this.when((input) => {
            if (t === 'array') return Array.isArray(input)
            if (typeof input === t) return true
            if (input instanceof t) return true
            return false
        })
    }

    regex(re) {
        return this.when((input) => re.test(input))
    }

    get opt() {
        return this.optional
    }
}

function notOptional(base) {
    return new DerivedMVar({ base, optional: false, type: 'notOptional' })
}

class DerivedMVar extends MVar {
    [Sym.SET_CONFIG]({ base, type = 'derived', optional, operations = [] }) {
        const baseConfig = base[Sym.CONFIG]
        this[Sym.CONFIG] = {
            ...baseConfig,
            mvar: baseConfig.mvar ?? base,
            type,
            optional: optional ?? baseConfig.optional ?? false,
            operations: [
                ...baseConfig.operations ?? [],
                ...operations
            ]
        }
    }
}

class MVarArrayRest {
    constructor(mvar) {
        this.mvar = mvar
    }
}

class BindingError extends Error { }

export class NoMatch extends Error { }

export function mvar(emit = true) {
    return new MVar({ type: 'mvar', emit })
}

export function wildcard() {
    return new Var({ type: 'wildcard', emit: false })
}

function isMVar(x) {
    return x instanceof MVar
}

function isWildcard(x) {
    return x instanceof Var && x?.[Sym.CONFIG]?.type === 'wildcard'
}

function isOptional(x) {
    return x instanceof Var && x?.[Sym.CONFIG]?.optional
}

function isMVarArrayRest(x) {
    return x instanceof MVarArrayRest
}

function getArrayRestMVar(x) {
    return x.mvar
}

function getObjectRestMVar(x) {
    return x[Sym.OBJECT_REST_REF]?.deref()
}

function isNoMatch(x) {
    return x instanceof NoMatch
}

function when(input, predicates) {
    for (const pred of predicates) {
        if (!pred(input))
            throw new NoMatch(
                'Input matches a negated pattern.\n' +
                `Input: ${input}`
            )
    }
    return { input }
}

function not(input, notPatterns, mvarsAndWildcard) {
    if (!checkNotPatterns(input, notPatterns, mvarsAndWildcard)) {
        throw new NoMatch(
            'Input matches a negated pattern.\n' +
            `Input: ${input}`
        )
    }
    return { input }
}

function then(input, xforms) {
    return { input: xforms.reduce((input, xform) => xform(input), input) }
}

function or(input, orPatterns, mvarsAndWildcard) {
    if (!orPatterns.length) return { input }

    for (const orPattern of orPatterns) {
        try {
            return { input, innerBindings: [...genBindings(orPattern, input, mvarsAndWildcard)] }
        } catch (e) {
            if (!isNoMatch(e)) {
                throw e
            }
        }
    }

    throw new NoMatch(
        'Input does not match provided or-patterns.\n' +
        `Input: ${input}`
    )
}

function checkNotPatterns(input, notPatterns, mvarsAndWildcard) {
    for (const notPattern of notPatterns) {
        try {
            // If any pattern matches, then the not pattern fails
            [...genBindings(notPattern, input, mvarsAndWildcard)] // Just to check if it throws
            return false // Pattern matched, which means not() should fail
        } catch (e) {
            if (!isNoMatch(e)) {
                throw e
            }
            // NoMatch is what we want - continue checking other patterns
        }
    }

    // All patterns raised NoMatch - the not pattern succeeds
    return true
}

function* emitBindingPairs(mvar, val, mvarsAndWildcard) {
    let input = val
    let innerBindings = []
    for (const operation of mvar[Sym.OPERATIONS]) {
        ({ input, innerBindings =[] } = operation(input, mvarsAndWildcard))
        yield* innerBindings
    }
    if (mvar[Sym.EMIT])
        yield [mvar[Sym.MVAR], input]
}

function* genBindingsForArray(pattern, input, mvarsAndWildcard) {
    let arrayRestFound = false
    let j = 0
    for (let i = 0; i < pattern.length; i++) {
        if (isMVarArrayRest(pattern[i])) {
            if (arrayRestFound) {
                throw new BindingError('Only one rest mvar allowed in array.')
            }
            arrayRestFound = true
            const end = input.length - (pattern.length - i - 1)
            const arrayRestMvar = getArrayRestMVar(pattern[i])
            if (!isWildcard(arrayRestMvar)) {
                const slice = input.slice(i, end)
                yield* emitBindingPairs(arrayRestMvar, slice, mvarsAndWildcard)
            }
            j += end - i
        } else if (isOptional(pattern[i])) {
            const inputSlice = input.slice(j, input.length)
            const patternSlice = pattern.slice(i + 1, pattern.length)

            yield* genBindings(
                mvar(false).or(
                    patternSlice,
                    [notOptional(pattern[i]), ...patternSlice],
                ),
                inputSlice,
                mvarsAndWildcard,
            )
            return
        } else if (!(j in input)) {
            throw new NoMatch(`Input is missing index: ${i}\nInput: ${input}`)
        } else {
            yield* genBindings(pattern[i], input[j], mvarsAndWildcard)
            j++
        }
    }

    if (j < input.length) {
        throw new NoMatch(`Pattern is missing index: ${j}`)
    }
}

function* genBindingsForObject(pattern, input, mvarsAndWildcard) {
    const restMVar = getObjectRestMVar(pattern)

    for (const k in pattern) {
        if (!(k in input)) {
            throw new NoMatch(`Input is missing key: ${k}\nInput: ${input}`)
        }
        yield* genBindings(pattern[k], input[k], mvarsAndWildcard)
    }

    if (restMVar) {
        checkNoMultipleObjectRestMVars(pattern, mvarsAndWildcard)
        if (!isWildcard(restMVar)) {
            const obj = Object.fromEntries(genNonVisitedKeyValues(input, pattern))
            yield* emitBindingPairs(restMVar, obj, mvarsAndWildcard)
        }
    } else {
        for (const k in input) {
            if (k in pattern) continue
            throw new NoMatch(`Pattern is missing key: ${k}`)
        }
    }
}

export function* genBindings(pattern, input, mvarsAndWildcard) {
    if (isOptional(pattern)) {
        throw new BindingError('Optional patterns only allowed in array patterns.')
    }

    if (isWildcard(pattern)) {
        // continue
    }

    else if (isMVar(pattern)) {
        yield* emitBindingPairs(pattern, input, mvarsAndWildcard)
    }

    else if (Array.isArray(pattern) && !isEmpty(pattern)) {
        yield* genBindingsForArray(pattern, input, mvarsAndWildcard)
    }

    else if (Array.isArray(pattern) && isEmpty(pattern) && isEmpty(input)) {
        // continue
    }

    else if (typeof pattern == 'object' && !isEmpty(pattern)) {
        yield* genBindingsForObject(pattern, input, mvarsAndWildcard)
    }

    else if (typeof pattern == 'object' && isEmpty(pattern) && isEmpty(input)) {
        // continue
    }

    else if (pattern !== input) {
        throw new NoMatch(
            'Input does not match provided pattern.\n' +
            `Pattern: ${pattern}\nInput: ${input}`
        )
    }
}

function checkNoMultipleObjectRestMVars(pattern, mvars) {
    let objectRestFound = false
    for (const mvar of mvars) {
        if (pattern[mvar[Sym.SYMBOL]]) {
            if (objectRestFound) {
                throw new BindingError('Only one rest mvar allowed in object.')
            }
            objectRestFound = true
        }
    }
}

function* genNonVisitedKeyValues(input, visited) {
    for (const [k, v] of Object.entries(input)) {
        if (!(k in visited))
            yield [k, v]
    }
}

function mvarGenerator() {
    const mvars = []

    function* generate() {
        yield* mvars
        while (true) {
            const v = mvar()
            mvars.push(v)
            yield v
        }
    }

    return {
        mvars,
        generate
    }
}

function partitionExpressions(expressions, ...args) {
    const expressions_ = typeof expressions == 'function' ? expressions(...args) : expressions
    return partition(2, expressions_)
}

function tryMatch(input, expressions) {
    const { mvars, generate } = mvarGenerator()
    const _ = wildcard()
    const patternOpts = {
        _,
        or: (...args) => mvar(false).or(...args),
        ofType: (...args) => mvar(false).ofType(...args),
        regex: (re) => mvar(false).regex(re),
        when: (predicate) => mvar(false).when(predicate),
        not: (...args) => mvar(false).not(...args)
    }
    const patterns = partitionExpressions(expressions, generate(), patternOpts)
    let caseIdx = 0
    for (let [pattern, result] of patterns) {
        if (!result) {
            // Reached a default case, since there's no result expression.
            return {
                bindings: [],
                caseIdx,
                resultIdx: 0,
            }
        }
        try {
            return {
                bindings: bind(pattern(generate(), patternOpts), input, mvars, _),
                caseIdx,
                resultIdx: 1,
            }
        } catch (e) {
            if (!isNoMatch(e)) {
                throw e
            }
        } finally {
            caseIdx++
        }
    }

    throw new NoMatch(
        'No valid matches for any patterns and no default case provided.'
    )
}

function bind(pattern, input, mvars, wildcard) {
    const bindings = new Map()
    for (const [mvar, value] of genBindings(pattern, input, [wildcard, ...mvars])) {
        if (bindings.has(mvar) && !deepEquals(bindings.get(mvar), value)) {
            throw new BindingError(`Variable cannot be bound to multiple values: ${bindings.get(mvar)} and ${value}`)
        }
        bindings.set(mvar, value)
    }
    return mvars.map(v => bindings.get(v))
}

// Utils
function seenInParents(a, parents) {
    for (const [parentA, parentB] of parents) {
        if (parentA === a) {
            return [parentA, parentB]
        }
    }
    return false
}

function _deepEquals(a, b, parents = []) {
    if (a === b) return true

    if (a && b && typeof a == 'object' && typeof b == 'object') {
        for (const k in b) {
            if (!(k in a)) return false
        }

        for (const k in a) {
            if (!(k in b)) return false

            const circular = seenInParents(a[k], parents)
            if (circular) {
                const [, parentB] = circular
                if (!_deepEquals(b[k], parentB)) return false
            } else if (!_deepEquals(a[k], b[k], [[a, b], ...parents])) {
                return false
            }
        }

        return true
    }

    return false
}

export function deepEquals(a, b) {
    return _deepEquals(a, b)
}

function get(coll, idx) {
    if (Array.isArray(coll)) {
        return coll[idx]
    }

    let i = 0
    for (const item of coll) {
        if (i == idx)
            return item
        i++
    }
}

function isEmpty(obj) {
    if (typeof obj !== 'object')
        return false

    if (Array.isArray(obj))
        return obj.length == 0

    for (let _ in obj)
        return false

    return true
}

function* genPartitions(n, collIterator) {
    for (let i = 0; i < n; i++) {
        const { value, done } = collIterator.next()
        if (done) return
        yield value
    }
}

export function* partition(n, coll) {
    const collIterator = coll[Symbol.iterator]()
    const nAtLeastZero = Math.max(n, 0)
    let result
    while ((result = Array.from(genPartitions(nAtLeastZero, collIterator))).length > 0) {
        yield result
    }
}