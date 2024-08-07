import { assert, FlexVector, isXMLName } from "./util";

// Object.prototype.constructor
const CONSTRUCTOR_INDEX = 0;

// dynamic class { ...[k]=v }
const DYNAMIC_PROPERTIES_INDEX = 1;

export abstract class Ns
{
    abstract toString(): string;

    ispublicns(): boolean
    {
        return this instanceof Systemns && this.kind == Systemns.PUBLIC;
    }

    ispublicorinternalns(): boolean
    {
        return this instanceof Systemns && (this.kind == Systemns.PUBLIC || this.kind == Systemns.INTERNAL);
    }
}

export class Systemns extends Ns
{
    static INTERNAL = 0;
    static PUBLIC = 1;
    static PRIVATE = 2;
    static PROTECTED = 3;
    static STATIC_PROTECTED = 4;

    kind: number = Systemns.INTERNAL;

    /**
     * Nullable reference to an ActionScript package or class.
     */
    parent: Object | null = null;

    constructor(kind: number, parent: Object | null)
    {
        super();
        this.kind = kind;
        this.parent = parent;
    }

    override toString(): string {
        return "namespace://actionscript.net/system";
    }
}

export class Userns extends Ns
{
    uri: string = "";

    constructor(uri: string)
    {
        super();
        this.uri = uri;
    }

    override toString(): string {
        return this.uri;
    }
}

export class Explicitns extends Ns
{
    uri: string = "";

    constructor(uri: string)
    {
        super();
        this.uri = uri;
    }

    override toString(): string {
        return this.uri;
    }
}

export class Package
{
    /**
     * Full name
     */
    readonly name: string;
    readonly publicns: Systemns = new Systemns(Systemns.PUBLIC, null);
    readonly internalns: Systemns = new Systemns(Systemns.INTERNAL, null);
    readonly names: Names = new Names();
    readonly varvals: Map<Variable, any> = new Map();

    /**
     * @param name Full name
     */
    constructor(name: string) 
    {
        this.name = name;
        this.publicns.parent = this;
        this.internalns.parent = this;
    }
}

const packages = new Map<string, Package>();

/**
 * Retrieves the `public` namespace of a package.
 */
export function packagens(name: string): Ns
{
    if (packages.has(name))
    {
        return packages.get(name)!.publicns;
    }
    const p = new Package(name);
    packages.set(name, p);
    return p.publicns;
}

/**
 * Retrieves the `internal` namespace of a package.
 */
export function packageinternalns(name: string): Ns
{
    if (packages.has(name))
    {
        return packages.get(name)!.internalns;
    }
    const p = new Package(name);
    packages.set(name, p);
    return p.internalns;
}

export class Name
{
    ns: Ns;
    name: string;

    constructor(ns: Ns, name: string)
    {
        this.ns = ns;
        this.name = name;
    }

    toString(): string
    {
        if (this.ns instanceof Userns)
        {
            return this.ns.uri + ":" + this.name;
        }
        else if (this.ns instanceof Explicitns)
        {
            return this.ns.uri + ":" + this.name;
        }
        else
        {
            return this.name;
        }
    }
}

export function name(ns: Ns, name: string): Name
{
    return new Name(ns, name);
}

/**
 * Mapping from (*ns*, *name*) to a trait object.
 */
export class Names
{
    private readonly m_dict: Map<Ns, Map<string, any>> = new Map<Ns, Map<string, any>>();

    constructor()
    {
    }
    
    dictionary(): Map<Name, any>
    {
        const result = new Map<Name, any>();
        for (const [ns, names] of this.m_dict)
        {
            for (const [name, trait] of names)
            {
                result.set(new Name(ns, name), trait);
            }
        }
        return result;
    }

    hasname(qual: any, name: string): boolean
    {
        if (!qual)
        {
            return this.haspublicname(name);
        }
        return qual instanceof Ns ? this.hasnsname(qual, name) : this.hasnssetname(qual, name);
    }

    hasnsname(ns: Ns, name: string): boolean
    {
        return this.m_dict.get(ns)?.has(name) ?? false;
    }

    hasnssetname(nsset: Ns[], name: string): boolean
    {
        let found = false;
        for (const ns of nsset)
        {
            const result = ns.ispublicns() || ns === as3ns ? this.getpublicname(name) : this.getnsname(ns, name);
            if (result !== null)
            {
                if (found)
                {
                    throw constructerror(referenceerrorclass, "Ambiguous reference to " + name + ".");
                }
                found = true;
            }
        }
        return found;
    }

    haspublicname(name: string): boolean
    {
        let found = false;
        for (const [ns, names] of this.m_dict)
        {
            if ((ns instanceof Systemns && ns.kind == Systemns.PUBLIC) || ns === as3ns)
            {
                const result = names.has(name);

                if (result)
                {
                    if (found)
                    {
                        throw constructerror(referenceerrorclass, "Ambiguous reference to " + name + ".");
                    }
                    found = true;
                }
            }
        }
        return found;
    }

    /**
     * Retrieves name by a generic qualifier (namespace, namespace array, or nothing)
     * and a local name.
     */
    getname(qual: any, name: string): any
    {
        if (qual instanceof Array)
        {
            return this.getnssetname(qual, name);
        }
        if (qual instanceof Ns)
        {
            return this.getnsname(qual, name);
        }
        assert(typeof qual === "undefined" || qual === null);
        return this.getpublicname(name);
    }
    
    getnsname(ns: Ns, name: string): any
    {
        return this.m_dict.get(ns)?.get(name) ?? null;
    }

    getnssetname(nsset: Ns[], name: string): any
    {
        for (const ns of nsset)
        {
            const result = ns.ispublicns() || ns === as3ns ? this.getpublicname(name) : this.getnsname(ns, name);
            if (result !== null)
            {
                return result;
            }
        }
        return null;
    }
    
    getpublicname(name: string): any
    {
        for (const [ns, names] of this.m_dict)
        {
            if ((ns instanceof Systemns && ns.kind == Systemns.PUBLIC) || ns === as3ns)
            {
                const result = names.get(name) ?? null;
                if (result !== null)
                {
                    return result;
                }
            }
        }
        return null;
    }

    setnsname(ns: Ns, name: string, trait: any): void
    {
        let names = this.m_dict.get(ns) ?? null;
        if (names === null)
        {
            names = new Map<string, any>();
            this.m_dict.set(ns, names);
        }
        names.set(name, trait);
    }
}

/**
 * Encodes certain details of a class.
 * 
 * An instance of a class is an Array object
 * whose first element is a reference to the Class object
 * corresponding to that class, and is used for computing
 * the `constructor` property.
 * 
 * An instance of a dynamic class will have the second element
 * as a Map<any, any> object containing dynamic properties.
 */
export class Class
{
    baseclass: any = null;
    interfaces: Interface[] = [];

    /**
     * Fully package qualified name.
     */
    name: string;
    final: boolean;
    dynamic: boolean;
    metadata: Metadata[];
    ctor: Function;

    readonly staticnames: Names = new Names();
    /**
     * The read-only ECMAScript 3 `prototype` Object
     * containing ActionScript values.
     */
    ecmaprototype: any = null;

    readonly prototypenames: Names = new Names();

    readonly staticvarvals: Map<Variable, any> = new Map();

    /**
     * Sequence of instance variables.
     * 
     * If the class is not dynamic, the first Variable element
     * identifies the slot number 1 of the instance Array;
     * if the class is dynamic, the first Variable element identifies
     * the slot number 2 of the instance Array.
     */
    prototypevarslots: Variable[] = [];

    constructor(name: string, final: boolean, dynamic: boolean, metadata: Metadata[], ctor: Function)
    {
        this.name = name;
        this.final = final;
        this.dynamic = dynamic;
        this.metadata = metadata;
        this.ctor = ctor;
    }

    recursivedescclasslist(): Class[]
    {
        const result: Class[] = [this];
        if (this.baseclass !== null)
        {
            result.push.apply(result, this.baseclass!.recursivedescclasslist());
        }
        return result;
    }
}

export type ClassOptions =
{
    extendslist?: any,
    implementslist?: Interface[],
    final?: boolean,
    dynamic?: boolean,
    metadata?: Metadata[],
    ctor?: Function,
};

export function defineclass(name: Name, options: ClassOptions, items: [Name, any][]): Class
{
    let finalname = "";
    if (name.ns instanceof Systemns && name.ns.parent instanceof Package)
    {
        finalname = name.ns.parent.name + "." + name.name;
    }

    const class1 = new Class(finalname, options.final ?? false, options.dynamic ?? false, options.metadata ?? [], options.ctor ?? function() {});

    const isobjectclass = name.ns === packagens("") && name.name == "Object";

    // Extend class
    if (!isobjectclass)
    {
        assert(!!objectclass);
        class1.baseclass = options.extendslist ?? objectclass;
        class1.ecmaprototype = construct(objectclass);
    }

    // Implement interfaces
    class1.interfaces = options.implementslist ?? [];

    // Define items
    const thesevars: Variable[] = [];
    for (const [itemname, item1] of items)
    {
        const item: PossiblyStatic = item1 as PossiblyStatic;
        assert(item instanceof PossiblyStatic);

        item.name = itemname.name;

        if (item.static)
        {
            class1.staticnames.setnsname(itemname.ns, itemname.name, item);
        }
        else
        {
            class1.prototypenames.setnsname(itemname.ns, itemname.name, item);
            if (item instanceof Variable)
            {
                thesevars.push(item);
            }
        }
    }

    // Calculate instance slots (-constructor [- dynamic] [+ fixed1 [+ fixed2 [+ fixedN]]])
    let baseslots: Variable[] = [];
    if (class1.baseclass !== null)
    {
        baseslots = class1.baseclass.prototypevarslots.slice(0);
    }
    class1.prototypevarslots.push.apply(baseslots, thesevars);

    // Finish
    globalnames.setnsname(name.ns, name.name, class1);

    if (isobjectclass)
    {
        class1.ecmaprototype = construct(objectclass);
    }

    return class1;
}

/**
 * Encodes certain details of an interface.
 */
export class Interface
{
    baseinterfaces: Interface[] = [];

    /**
     * Fully package qualified name.
     */
    name: string;
    metadata: Metadata[];

    readonly prototypenames: Names = new Names();

    constructor(name: string, metadata: Metadata[])
    {
        this.name = name;
        this.metadata = metadata;
    }
    
    recursivedescinterfacelist(): Interface[]
    {
        const result: Interface[] = [this];
        for (const itrfc1 of this.baseinterfaces)
        {
            result.push.apply(result, itrfc1.recursivedescinterfacelist());
        }
        return result;
    }
}

export type InterfaceOptions =
{
    extendslist?: Interface[],
    metadata?: Metadata[],
};

export function defineinterface(name: Name, options: InterfaceOptions, items: [Name, any][]): Interface
{
    let finalname = "";
    if (name.ns instanceof Systemns && name.ns.parent instanceof Package)
    {
        finalname = name.ns.parent.name + "." + name.name;
    }

    const itrfc = new Interface(finalname, options.metadata ?? []);

    // Extends interfaces
    itrfc.baseinterfaces = options.extendslist ?? [];

    // Define items
    for (const [itemname, item1] of items)
    {
        const item: PossiblyStatic = item1 as PossiblyStatic;
        assert(item instanceof PossiblyStatic);
        assert(!item.static && (item instanceof VirtualVariable || item instanceof Method));
        item.name = itemname.name;
        itrfc.prototypenames.setnsname(itemname.ns, itemname.name, item);
    }

    // Finish
    globalnames.setnsname(name.ns, name.name, itrfc);

    return itrfc;
}

/**
 * Meta-data attached to traits such as classes, methods and properties.
 */
export class Metadata
{
    name: string;
    entries: [string | null, string][];

    constructor(name: string, entries: [string | null, string][])
    {
        this.name = name;
        this.entries = entries;
    }
}

export class PossiblyStatic
{
    /**
     * Fully package qualified name.
     */
    name: string = "";
    static: boolean = false;
}

export class Nsalias extends PossiblyStatic
{
    ns: Ns;

    constructor(name: string, ns: Ns)
    {
        super();
        this.name = name;
        this.ns = ns;
    }
}

export type NsaliasOptions =
{
    ns: Ns,
    static?: boolean,
};

export function nsalias(options: NsaliasOptions): Nsalias
{
    const r = new Nsalias("", options.ns);
    r.static = options.static ?? false;
    return r;
}

export class Variable extends PossiblyStatic
{
    readonly: boolean;
    metadata: Metadata[];
     type: any;

    constructor(name: string, readonly: boolean, metadata: Metadata[], type: any)
    {
        super();
        this.name = name;
        this.readonly = readonly;
        this.metadata = metadata;
        this.type = type;
    }
}

export type VariableOptions =
{
    readonly?: boolean,
    metadata?: Metadata[],
    type: any,
    static?: boolean,
};

export function variable(options: VariableOptions): Variable
{
    const varb = new Variable("", options.readonly ?? false, options.metadata ?? [], options.type);
    varb.static = options.static ?? false;
    return  varb;
}

export class VirtualVariable extends PossiblyStatic
{
    getter: Method | null;
    setter: Method | null;
    metadata: Metadata[];
     type: any;

    constructor(name: string, getter: Method | null, setter: Method | null, metadata: Metadata[], type: any)
    {
        super();
        this.name = name;
        this.getter = getter;
        this.setter = setter;
        this.metadata = metadata;
        this.type = type;
    }
}

export type VirtualVariableOptions =
{
    getter: Method | null,
    setter: Method | null,
    metadata?: Metadata[],
    type: any,
    static?: boolean,
};

export function virtualvar(options: VirtualVariableOptions): VirtualVariable
{
    const vvar = new VirtualVariable("", options.getter, options.setter, options.metadata ?? [], options.type);
    vvar.static = options.static ?? false;
    return vvar;
}

export class Method extends PossiblyStatic
{
    metadata: Metadata[];

    /**
     * The main function of a method: if it is overriden by another method,
     * then it will not invoke `nodisp` and will interrupt, invoking
     * the overriding method.
     */
    disp: Function;

    nodisp: Function;

    constructor(name: string, metadata: Metadata[], disp: Function, nodisp: Function)
    {
        super();
        this.name = name;
        this.metadata = metadata;
        this.disp = disp;
        this.nodisp = nodisp;
    }
}

export type MethodOptions =
{
    disp: Function,
    nodisp: Function,
    metadata?: Metadata[],
    static?: boolean,
};

export function method(options: MethodOptions): Method
{
    const m = new Method("", options.metadata ?? [], options.disp, options.nodisp);
    m.static = options.static ?? false;
    return m;
}

const globalnames = new Names();

const globalvarvals = new Map<Variable, any>();

/**
 * Maps (instance) to (method) to (bound method Function instance).
 */
const boundmethods = new WeakMap<any, Map<Method, any>>();

/**
 * Checks whether an object has or inherits a given property name.
 * 
 * This method is used by the `name in o` expression, where
 * `o` is either a base class or a base instance.
 */
export function inobject(base: any, name: any): boolean
{
    if (base instanceof Array)
    {
        const ctor = base[CONSTRUCTOR_INDEX] as Class;
        if (ctor.dynamic)
        {
            if (base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
            {
                return true;
            }
        }
        let c1 = ctor;
        while (c1 !== null)
        {
            if (c1.prototypenames.haspublicname(String(name)))
            {
                return true;
            }
            // ECMAScript 3 prototype
            if (hasonlydynamicproperty(c1.ecmaprototype, String(name)))
            {
                return true;
            }
            c1 = c1.baseclass;
        }
        // Test collection properties (Array, Vector[$double|$float|$int|$uint], Dictionary)
        if (istype(base, arrayclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[ARRAY_SUBARRAY_INDEX].length;
        }
        if (istype(base, vectorclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
        }
        if (istype(base, vectordoubleclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
        }
        if (istype(base, vectorfloatclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
        }
        if (istype(base, vectorintclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
        }
        if (istype(base, vectoruintclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
        }
        if (istype(base, dictionaryclass))
        {
            const mm = base[DICTIONARY_PROPERTIES_INDEX];
            if (mm instanceof WeakMap && !(name instanceof Array))
            {
                throw constructerror(referenceerrorclass, "Weak key must be a managed Object.");
            }
            return mm.has(name);
        }

        // Test the "Class" object
        if (istype(base, classclass) && inobject(base[CLASS_CLASS_INDEX], name))
        {
            return true;
        }
    }
    // Class static
    if (base instanceof Class)
    {
        if (String(name) == "prototype")
        {
            return true;
        }
        let c1 = base;
        while (c1 !== null)
        {
            if (c1.staticnames.haspublicname(String(name)))
            {
                return true;
            }
            c1 = c1.baseclass;
        }
    }
    return false;
}

/**
 * Checks whether an object owns a given property name or key.
 * 
 * This method looks for Array element indices and own variables,
 * either for a base class or for a base instance.
 */
export function hasownproperty(base: any, name: any): boolean
{
    if (base instanceof Array)
    {
        const ctor = base[CONSTRUCTOR_INDEX] as Class;
        if (ctor.dynamic)
        {
            if (base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
            {
                return true;
            }
        }
        let c1 = ctor;
        while (c1 !== null)
        {
            let varb = c1.prototypenames.getpublicname(String(name));
            if (varb instanceof Variable || varb instanceof VirtualVariable)
            {
                return true;
            }
            c1 = c1.baseclass;
        }
        // Test collection properties (Array, Vector[$double|$float|$int|$uint], Dictionary)
        if (istype(base, arrayclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[ARRAY_SUBARRAY_INDEX].length;
        }
        if (istype(base, vectorclass) || istype(base, vectordoubleclass) || istype(base, vectorfloatclass) || istype(base, vectorintclass) || istype(base, vectoruintclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
        }
        if (istype(base, dictionaryclass))
        {
            const mm = base[DICTIONARY_PROPERTIES_INDEX];
            if (mm instanceof WeakMap && !(name instanceof Array))
            {
                throw constructerror(referenceerrorclass, "Weak key must be a managed Object.");
            }
            return mm.has(name);
        }

        // Test the "Class" object
        if (istype(base, classclass) && hasownproperty(base[CLASS_CLASS_INDEX], name))
        {
            return true;
        }
    }
    // Class static
    if (base instanceof Class)
    {
        if (String(name) == "prototype")
        {
            return true;
        }
        let varb = base.staticnames.getpublicname(String(name));
        return varb instanceof Variable;
    }
    return false;
}

/**
 * Retrieves the value of a property.
 */
export function getproperty(base: any, qual: any, name: any): any
{
    // instance
    if (base instanceof Array)
    {
        const ctor = base[CONSTRUCTOR_INDEX] as Class;
        const slotfixturestart = ctor.dynamic ? 2 : 1;

        // instance prototype
        let c1 = ctor;
        while (c1 !== null)
        {
            let itrait = c1.prototypenames.getname(qual, String(name));
            if (itrait)
            {
                // variable
                if (itrait instanceof Variable)
                {
                    const i = ctor.prototypevarslots.indexOf(itrait);
                    return base[slotfixturestart + i];
                }
                // property accessor
                if (itrait instanceof VirtualVariable)
                {
                    const getter = itrait.getter;
                    if (getter === null)
                    {
                        throw constructerror(referenceerrorclass, "Cannot read write-only property.");
                    }
                    return getter!.disp.apply(base, []);
                }
                // bound method
                if (itrait instanceof Method)
                {
                    let bm1 = boundmethods.get(base);
                    if (!bm1)
                    {
                        bm1 = new Map<Method, any>();
                        boundmethods.set(base, bm1);
                    }
                    let bm: any = boundmethods.get(itrait);
                    if (bm === null)
                    {
                        bm = construct(functionclass);
                        bm[FUNCTION_FUNCTION_INDEX] = itrait.disp.bind(base);
                        boundmethods.set(itrait, bm);
                    }
                    return bm;
                }
                if (itrait instanceof Nsalias)
                {
                    return reflectnamespace(itrait.ns);
                }
                
                throw constructerror(referenceerrorclass, "Internal error");
            }
            
            // instance ecmaprototype
            if ((!qual || (qual instanceof Ns && qual.ispublicns())) && hasonlydynamicproperty(c1.ecmaprototype, String(name)))
            {
                return getonlydynamicproperty(c1.ecmaprototype, String(name));
            }

            c1 = c1.baseclass;
        }

        if (!qual || (qual instanceof Ns && qual.ispublicns()))
        {
            if (ctor.dynamic)
            {
                if (base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
                {
                    return base[DYNAMIC_PROPERTIES_INDEX].get(String(name));
                }
            }

            // Read collection properties (Array, Vector[$double|$float|$int|$uint], Dictionary)

            if (istype(base, arrayclass) && Number(name) == name >> 0)
            {
                return base[ARRAY_SUBARRAY_INDEX][name >> 0];
            }
            if (istype(base, vectorclass) && Number(name) == name >> 0)
            {
                let i = name >> 0;
                if (i < 0 || i >= base[VECTOR_SUBARRAY_INDEX].length)
                {
                    throw constructerror(referenceerrorclass, "Index " + i + " out of bounds (length=" + base[VECTOR_SUBARRAY_INDEX].length + ").");
                }
                return base[VECTOR_SUBARRAY_INDEX][i];
            }
            if ((istype(base, vectordoubleclass) || istype(base, vectorfloatclass) || istype(base, vectorintclass) || istype(base, vectoruintclass)) && Number(name) == name >> 0)
            {
                let i = name >> 0, l = base[VECTOR_SUBARRAY_INDEX].length;
                if (i < 0 || i >= l)
                {
                    throw constructerror(referenceerrorclass, "Index " + i + " out of bounds (length=" + l + ").");
                }
                return base[VECTOR_SUBARRAY_INDEX].get(i);
            }
            if (istype(base, dictionaryclass))
            {
                const mm = base[DICTIONARY_PROPERTIES_INDEX];
                if (mm instanceof WeakMap && !(name instanceof Array))
                {
                    throw constructerror(referenceerrorclass, "Weak key must be a managed Object.");
                }
                return mm.get(name);
            }
        }

        // Read the "Class" object's class properties
        if (istype(base, classclass))
        {
            return getproperty(base[CLASS_CLASS_INDEX], qual, name);
        }

        throw constructerror(referenceerrorclass, "Access of undefined property +" + name + ".");
    }
    // class static
    if (base instanceof Class)
    {
        if (String(name) == "prototype")
        {
            return base.ecmaprototype;
        }
        let c1 = base;
        while (c1 !== null)
        {
            const trait = c1.staticnames.getname(qual, name);
            if (trait)
            {
                // variable
                if (trait instanceof Variable)
                {
                    return c1.staticvarvals.get(trait);
                }
                // property accessor
                if (trait instanceof VirtualVariable)
                {
                    const getter = trait.getter;
                    if (getter === null)
                    {
                        throw constructerror(referenceerrorclass, "Cannot read write-only property.");
                    }
                    return getter!.disp.apply(undefined, []);
                }
                // method
                if (trait instanceof Method)
                {
                    return trait.disp.apply(undefined, []);
                }
                // namespace
                if (trait instanceof Nsalias)
                {
                    return reflectnamespace(trait.ns);
                }
                throw constructerror(referenceerrorclass, "Internal error");
            }
            c1 = c1.baseclass;
        }
    }
    // Number
    if (typeof base == "number")
    {
        return getproperty([numberclass, base], qual, name);
    }
    // Boolean
    if (typeof base == "boolean")
    {
        return getproperty([booleanclass, base], qual, name);
    }
    // String
    if (typeof base == "string")
    {
        return getproperty([stringclass, base], qual, name);
    }
    // null
    if (base === null)
    {
        throw constructerror(referenceerrorclass, "Cannot read property of null.");
    }
    // undefined
    throw constructerror(referenceerrorclass, "Cannot read property of undefined.");
}

export function getonlydynamicproperty(base: any, name: any): any
{
    assert(base instanceof Array);
    const ctor = base[CONSTRUCTOR_INDEX] as Class;
    assert(ctor.dynamic);
    return (base[DYNAMIC_PROPERTIES_INDEX] as Map<any, any>).get(name);
}

export function setonlydynamicproperty(base: any, name: any, value: any): any
{
    assert(base instanceof Array);
    const ctor = base[CONSTRUCTOR_INDEX] as Class;
    assert(ctor.dynamic);
    (base[DYNAMIC_PROPERTIES_INDEX] as Map<any, any>).set(name, value);
}

export function deleteonlydynamicproperty(base: any, name: any): boolean
{
    assert(base instanceof Array);
    const ctor = base[CONSTRUCTOR_INDEX] as Class;
    assert(ctor.dynamic);
    return (base[DYNAMIC_PROPERTIES_INDEX] as Map<any, any>).delete(name);
}

export function hasonlydynamicproperty(base: any, name: any): boolean
{
    assert(base instanceof Array);
    const ctor = base[CONSTRUCTOR_INDEX] as Class;
    assert(ctor.dynamic);
    return (base[DYNAMIC_PROPERTIES_INDEX] as Map<any, any>).has(name);
}

/**
 * Checks for `v is T`.
 */
export function istype(value: any, type: any): boolean
{
    // type = null = *
    // type = [object Class] = a class
    // type = [object Interface] = an interface

    if (value instanceof Array)
    {
        const instanceClasses = (value[CONSTRUCTOR_INDEX] as Class).recursivedescclasslist();

        if (type instanceof Class)
        {
            return instanceClasses.indexOf(type!) !== -1;
        }
        if (type instanceof Interface)
        {
            for (const class1 of instanceClasses)
            {
                for (const itrfc1 of class1.interfaces)
                {
                    const itrfcs = itrfc1.recursivedescinterfacelist();
                    if (itrfcs.indexOf(type!) !== -1)
                    {
                        return true;
                    }
                }
            }
        }
    }
    if (type instanceof Class)
    {
        return (
            (typeof value === "number" && (numberclasses.indexOf(type) !== -1) || type === objectclass) ||
            (typeof value === "string" && (type == stringclass || type === objectclass)) ||
            (typeof value === "boolean" && (type == booleanclass || type === objectclass))
        );
    }
    return type === null;
}

const m_coercionDataView = new DataView(new ArrayBuffer(32));

/**
 * Performs implicit coercion.
 */
export function coerce(value: any, type: any): any
{
    if (!istype(value, type))
    {
        if (type instanceof Class)
        {
            return (
                type === objectclass && typeof value === "undefined" ? undefined :
                floatclasses.indexOf(type) !== -1 ? NaN :
                integerclasses.indexOf(type) !== -1 ? 0 :
                type === booleanclass ? false : null
            );
        }
        return null;
    }
    if (numberclasses.indexOf(type) !== -1)
    {
        switch (type)
        {
            case floatclass:
                m_coercionDataView.setFloat32(0, value);
                value = m_coercionDataView.getFloat32(0);
                return value;
            case numberclass:
                return Number(value);
            case intclass:
                m_coercionDataView.setInt32(0, value);
                value = m_coercionDataView.getInt32(0);
                return value;
            case uintclass:
                m_coercionDataView.setUint32(0, value);
                value = m_coercionDataView.getUint32(0);
                return value;
        }
    }
    return value;
}

/**
 * Constructs an ActionScript class.
 */
export function construct(classobj: Class, ...args: any[]): any
{
    switch (classobj)
    {
        case numberclass:
        case floatclass:
            return args.length == 0 ? NaN : Number(args[0]);
        case intclass:
            return args.length == 0 ? 0 : args[0] >>> 0;
        case uintclass:
            return args.length == 0 ? 0 : args[0] >> 0;
        case booleanclass:
            return args.length == 0 ? false : !!args[0];
        case stringclass:
            return args.length == 0 ? "" : String(args[0]);
    }
    const instance: any = [classobj];
    if (classobj.dynamic)
    {
        instance[DYNAMIC_PROPERTIES_INDEX] = new Map<any, any>();
    }
    classobj.ctor.apply(instance, args);
    return instance;
}

/**
 * Converts an argument to a string.
 */
export function tostring(arg: any): string
{
    if (typeof arg == "string")
    {
        return arg;
    }
    if (typeof arg == "number" || typeof arg == "boolean" || typeof arg == "undefined" || arg === null)
    {
        return String(arg);
    }
    try
    {
        const m = getproperty(arg, null, "toString");
        if (m instanceof Method)
        {
            return tostring(m.disp.apply(arg, []));
        }
    }
    catch (e)
    {
    }
    return "[object]";
}

/**
 * The `AS3` namespace.
 */
export const as3ns = new Userns("http://adobe.com/AS3/2006/builtin");

/**
 * The `flash_proxy` namespace.
 */
export const flashproxyns = new Userns("http://www.adobe.com/2006/actionscript/flash/proxy");

// ----- Globals -----

let $publicns = packagens("");

export const objectclass = defineclass(name($publicns, "Object"),
    {
        dynamic: true,
    },
    [
    ]
);

const NAMESPACE_PREFIX_INDEX = 1; // prefix:String
const NAMESPACE_URI_INDEX = 2; // uri:String
export const namespaceclass = defineclass(name($publicns, "Namespace"),
    {
        final: true,

        // Namespace(uri:*)
        // Namespace(prefix:*, uri:*)
        ctor(this: any, arg1: any, arg2: any = undefined)
        {
            this[NAMESPACE_PREFIX_INDEX] =
            this[NAMESPACE_URI_INDEX] = "";

            if (typeof arg2 === "undefined")
            {
                if (istype(arg1, namespaceclass))
                {
                    this[NAMESPACE_URI_INDEX] = arg1[NAMESPACE_URI_INDEX];
                }
                else if (istype(arg1, qnameclass))
                {
                    this[NAMESPACE_URI_INDEX] = arg1[QNAME_URI_INDEX];
                }
                else
                {
                    this[NAMESPACE_URI_INDEX] = tostring(arg1);
                }
            }
            else
            {
                // arg1 = prefixValue
                if (typeof arg1 === "undefined" || !isXMLName(arg1))
                {
                    this[NAMESPACE_PREFIX_INDEX] = "undefined";
                }
                else
                {
                    this[NAMESPACE_PREFIX_INDEX] = tostring(arg1);
                }

                // arg2 = uriValue
                if (istype(arg2, qnameclass))
                {
                    this[NAMESPACE_URI_INDEX] = arg2[QNAME_URI_INDEX];
                }
                else
                {
                    this[NAMESPACE_URI_INDEX] = tostring(arg2);
                }
            }
        },
    },
    [
    ]
);

/**
 * Constructs a `Namespace` object from an ActionScript namespace.
 */
export function reflectnamespace(ns: Ns): any
{
    let uri = ns instanceof Systemns ? "" : ns instanceof Userns ? ns.uri : (ns as Explicitns).uri;
    if (ns instanceof Systemns)
    {
        let p = ns.parent instanceof Package ? ns.parent.name : ns.parent instanceof Class ? ns.parent.name : "";
        uri = p + "$" + (Math.random() * 16).toString(16).replace(".", "").slice(0, 5);
    }
    return construct(namespaceclass, [uri]);
}

const QNAME_URI_INDEX = 1; // uri:String?
const QNAME_LOCALNAME_INDEX = 2; // localName:String
export const qnameclass = defineclass(name($publicns, "QName"),
    {
        final: true,

        // QName(qname:*)
        // QName(uri:*, localName:*)
        ctor(this: any, arg1: any, arg2: any = undefined)
        {
            this[QNAME_URI_INDEX] = null;
            this[QNAME_LOCALNAME_INDEX] = "";

            // QName(qname:*)
            if (typeof arg2 === "undefined" || arg2 === null)
            {
                if (typeof arg1 === "undefined")
                {
                    this[QNAME_LOCALNAME_INDEX] = "";
                }
                else if (istype(arg1, qnameclass))
                {
                    this[QNAME_URI_INDEX] = arg1[QNAME_URI_INDEX];
                    this[QNAME_LOCALNAME_INDEX] = arg1[QNAME_LOCALNAME_INDEX];
                }
                else
                {
                    this[QNAME_LOCALNAME_INDEX] = tostring(arg1);
                }
            }
            // QName(uri:*, localName:*)
            else
            {
                if (typeof arg1 !== "undefined" && arg1 !== null)
                {
                    if (istype(arg1, namespaceclass))
                    {
                        this[QNAME_URI_INDEX] = arg1[NAMESPACE_URI_INDEX];
                    }
                    else
                    {
                        this[QNAME_URI_INDEX] = tostring(arg1);
                    }
                }

                if (istype(arg2, qnameclass))
                {
                    this[QNAME_LOCALNAME_INDEX] = arg2[QNAME_LOCALNAME_INDEX];
                }
                else
                {
                    this[QNAME_LOCALNAME_INDEX] = tostring(arg2);
                }
            }
        },
    },
    [
    ]
);

const CLASS_CLASS_INDEX = 1;
export const classclass = defineclass(name($publicns, "Class"),
    {
        ctor(this: any)
        {
            this[CLASS_CLASS_INDEX] = classclass;
        },
    },
    [
    ]
);

const NUMBER_VALUE_INDEX = 1;
export const numberclass = defineclass(name($publicns, "Number"),
    {
        final: true,

        ctor(this: any)
        {
            this[NUMBER_VALUE_INDEX] = 0;
        },
    },
    [
    ]
);

export const intclass = defineclass(name($publicns, "int"),
    {
        final: true,
    },
    [
    ]
);

export const uintclass = defineclass(name($publicns, "uint"),
    {
        final: true,
    },
    [
    ]
);

export const floatclass = defineclass(name($publicns, "float"),
    {
        final: true,
    },
    [
    ]
);

export const numberclasses = [numberclass, intclass, uintclass, floatclass];
export const floatclasses = [numberclass, floatclass];
export const integerclasses = [intclass, uintclass];

const BOOLEAN_VALUE_INDEX = 1;
export const booleanclass = defineclass(name($publicns, "Boolean"),
    {
        final: true,

        ctor(this: any)
        {
            this[BOOLEAN_VALUE_INDEX] = true;
        },
    },
    [
    ]
);

const STRING_VALUE_INDEX = 1;
export const stringclass = defineclass(name($publicns, "String"),
    {
        final: true,

        ctor(this: any)
        {
            this[STRING_VALUE_INDEX] = "";
        },
    },
    [
    ]
);

const ARRAY_SUBARRAY_INDEX = DYNAMIC_PROPERTIES_INDEX + 1;
export const arrayclass = defineclass(name($publicns, "Array"),
    {
        dynamic: true,

        ctor(this: any, length: number = 0)
        {
            this[ARRAY_SUBARRAY_INDEX] = new Array(Math.max(0, length >>> 0));
        },
    },
    [
    ]
);

const ERROR_NAME_INDEX = 2; // name:String
const ERROR_MESSAGE_INDEX = 3; // message:String
const ERROR_ERRORID_INDEX = 4; // errorID:int
const ERROR_STACKTRACE_ELEMENTS_INDEX = 5; // an array of StackTrace
export const errorclass = defineclass(name($publicns, "Error"),
    {
        dynamic: true,

        ctor(this: any, message: string = "", id: number = 0)
        {
            this[ERROR_NAME_INDEX] = (this[CONSTRUCTOR_INDEX] as Class).name;
            this[ERROR_MESSAGE_INDEX] = tostring(message);
            this[ERROR_ERRORID_INDEX] = id >> 0;
            this[ERROR_STACKTRACE_ELEMENTS_INDEX] = [];
        },
    },
    [
    ]
);

/**
 * Constructs an ActionScript `Error` object.
 */
export function constructerror(errorclass: Class, message: string = "", id: number = 0, stacktraceElements: StackTrace[] = []): any
{
    const obj = construct(errorclass);
    assert(istype(obj, errorclass));
    obj[ERROR_MESSAGE_INDEX] = tostring(message);
    obj[ERROR_ERRORID_INDEX] = id >> 0;
    obj[ERROR_STACKTRACE_ELEMENTS_INDEX] = stacktraceElements.slice(0);
    return obj;
}

export const argumenterrorclass = defineclass(name($publicns, "ArgumentError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const definitionerrorclass = defineclass(name($publicns, "DefinitionError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const evalerrorclass = defineclass(name($publicns, "EvalError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const rangeerrorclass = defineclass(name($publicns, "RangeError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const referenceerrorclass = defineclass(name($publicns, "ReferenceError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const securityerrorclass = defineclass(name($publicns, "SecurityError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const syntaxerrorclass = defineclass(name($publicns, "SyntaxError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const typeerrorclass = defineclass(name($publicns, "TypeError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const urierrorclass = defineclass(name($publicns, "URIError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const verifyerrorclass = defineclass(name($publicns, "VerifyError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(this: any, message: string = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

/**
 * A (method name, source location) group.
 */
export class StackTrace
{
    methodName: string;
    sourceLocation: string;

    constructor(methodName: string, sourceLocation: string)
    {
        this.methodName = methodName;
        this.sourceLocation = sourceLocation;
    }
}

function mdefaultfunction() {}

const FUNCTION_FUNCTION_INDEX = 1;
export const functionclass = defineclass(name($publicns, "Function"),
    {
        final: true,

        ctor(this: any)
        {
            this[FUNCTION_FUNCTION_INDEX] = mdefaultfunction;
        },
    },
    [
    ]
);

$publicns = packagens("__AS3__.vec");

const VECTOR_SUBARRAY_INDEX = 1;
const VECTOR_FIXED_INDEX = 2;
export const vectorclass = defineclass(name($publicns, "Vector"),
    {
        ctor(this: any, length: number = 0, fixed: boolean = false)
        {
            this[VECTOR_SUBARRAY_INDEX] = new Array(Math.max(0, length >>> 0));
            this[VECTOR_FIXED_INDEX] = !!fixed;
        },
    },
    [
    ]
);

export const vectordoubleclass = defineclass(name($publicns, "Vector$double"),
    {
        ctor(this: any, length: number = 0, fixed: boolean = false)
        {
            this[VECTOR_SUBARRAY_INDEX] = new FlexVector(Float64Array, Number(length), fixed);
        },
    },
    [
    ]
);

export const vectorfloatclass = defineclass(name($publicns, "Vector$float"),
    {
        ctor(this: any, length: number = 0, fixed: boolean = false)
        {
            this[VECTOR_SUBARRAY_INDEX] = new FlexVector(Float32Array, Number(length), fixed);
        },
    },
    [
    ]
);

export const vectorintclass = defineclass(name($publicns, "Vector$int"),
    {
        ctor(this: any, length: number = 0, fixed: boolean = false)
        {
            this[VECTOR_SUBARRAY_INDEX] = new FlexVector(Int32Array, Number(length), fixed);
        },
    },
    [
    ]
);

export const vectoruintclass = defineclass(name($publicns, "Vector$uint"),
    {
        ctor(this: any, length: number = 0, fixed: boolean = false)
        {
            this[VECTOR_SUBARRAY_INDEX] = new FlexVector(Uint32Array, Number(length), fixed);
        },
    },
    [
    ]
);

$publicns = packagens("flash.utils");

const DICTIONARY_PROPERTIES_INDEX = 1;
export const dictionaryclass = defineclass(name($publicns, "Dictionary"),
    {
        ctor(this: any, weakKeys: boolean = false)
        {
            this[DICTIONARY_PROPERTIES_INDEX] = weakKeys ? new WeakMap<any, any>() : new Map<any, any>();
        },
    },
    [
    ]
);