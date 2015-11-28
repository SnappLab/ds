


  var $context$ = function (contextScope, logic) {
    return $logic$(function applyContext(scope, originalScope) {
      return logic(contextScope, scope, true);
    });
  };

  var getNamedValue = function (name, value, scope, originalScope, step) {
    if (name in literals) {
      value = literals[name];
    }

    else if (/^\d+$/.test(name)) {
      if (typeof value === 'number') {
        value = parseFloat(value + '.' + name);
      }

      else {
        value = parseInt(name);
      }
    }

    else if (name[0] === '@') {
      var shortName = name.substr(1);

      if (shortName === '') {
        value = undefined;
      }

      else {
        value = scope[name];

        if (originalScope && typeof value === 'undefined') {
          value = originalScope[name];
        }

        if (typeof value === 'undefined') {
          if (!(shortName in ds.global)) {
            throw ds.errorMessage(
              new TypeError('Injectable "' + name + '" not found'), step
            );
          }
          value = ds.global[shortName];
        }
      }
    }

    else {
      if (value === null) {
        throw ds.errorMessage(new TypeError('Cannot read property of nil:'), step);
      }

      else if (typeof value === 'undefined') {
        throw ds.errorMessage(
          new TypeError('Cannot read property of undef:'), step
        );
      }

      var lastValue = value;
      value = value[name];

      if (value && value.$get$) {
        if (lastValue && lastValue.$state$) {
          value = value(lastValue, scope);
        }

        else {
          value = value(scope, originalScope);
        }
      }

      if (lastValue === scope && originalScope && typeof value === 'undefined') {
        value = originalScope[name];
      }

      if (typeof value === 'function') {
        if (value.$trap$) {
          ;
        }
        else if (value.$logic$) {
          if (lastValue !== scope && lastValue.$state$) {
            value = $context$(lastValue, value);
          }
        }
        else {
          value = value.bind(lastValue);
        }
      }

      if (typeof value === 'undefined') {
        throw ds.errorMessage(
          new TypeError(name + ' is not defined'), step
        );
      }
    }

    return value;
  };

   /**
    * This file can be used in the following modes:
    *
    * On the command line:
    *   node ds source.ds
    *
    * In Node:
    *   var ds = require('ds');
    *   ds("'Hello World' @console.log");
    *   ds.console.log(ds.parse('1 + 3')(ds.scope()));
    */
  var ds = {
    equals: function (a, b) {
      if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
          return false;
        }
        return a.filter(function (x, i) {
          return ds.equals(x, b[i]);
        }).length === a.length;
      }
      return a === b;
    },
    global: {
      args: $trap$(function (args) {
        return $trap$(function (fn) {
          return fn.apply(null, args);
        });
      }),
      class: $trap$(function (cls, classCreatedScope) {
        if (typeof cls !== 'function' || !cls.$logic$) {
          throw new Error('@class must be followed by a logic block');
        }

        var classScope = ds.scope(classCreatedScope);
        cls(classScope);

        return $trap$(function (instance, instanceCreatedScope) {
          if (typeof instance !== 'function' || !instance.$logic$) {
            throw new Error('@class {...} must be followed by a logic block');
          }
          var instanceScope = ds.scope(classScope);
          return instance(instanceScope, instanceCreatedScope);
        });
      }),
      default: $trap$(function (value, scope) {
        if (typeof scope.$state$.lastValue !== 'undefined') {
          return scope.$state$.lastValue;
        }
        return value;
      }),
      expect: $logic$(function (scope, originalScope) {
        var value = scope[IT];
        return $trap$(function (expected) {
          scope.$expectations$.push([value, expected]);
        });
      }),
      get: $trap$(function (value, scope) {
        if (typeof value !== 'function' || !value.$logic$) {
          throw new Error('@get must be followed by a logic block');
        }
        value.$get$ = true;
        return value;
      }),
      named: $trap$(function (names, scope) {
        if (typeof names === 'string') {
          names = [names];
        }
        if (!Array.isArray(names)) {
          throw new Error('@named must be followed by a name or array of names');
        }
        return $trap$(function (fn) {
          if (typeof fn !== 'function' || !fn.$logic$) {
            throw new Error('@named [...] must be followed by a logic block');
          }

          return function namedArguments() {
            var args = arguments;
            var newScope = ds.scope(scope);
            names.forEach(function (name, i) {
              newScope[name] = args[i];
            });
            return fn(newScope);
          };
        });
      }),
      test: $trap$(function (description, scope) {
        if (typeof description !== 'string') {
          throw new Error('@test must be followed by a string');
        }

        var testScope = ds.scope(scope);
        if (!Array.isArray(testScope.$test$)) {
          testScope.$test$ = [];
        }

        testScope.$test$ = testScope.$test$.slice();
        testScope.$test$.push(description);

        return $trap$(function (block, scope) {
          if (typeof block !== 'function' || !block.$logic$) {
            throw new Error('@test must be followed by a logic block');
          }

          var blockScope = ds.scope(testScope);
          blockScope.$expectations$ = [];
          block(blockScope);

          if (blockScope.$expectations$.length > 0) {
            var passed = blockScope.$expectations$.filter(function (e) {
              return ds.equals(e[0], e[1]);
            }).length;
            var total = blockScope.$expectations$.length;
            var result = [passed, total].join('/') + ' passed.'
            console.log(passed == total ? '  ✔': '  ✘',
              testScope.$test$.join(' ') + ':', result);
          }

          blockScope.$expectations$.forEach(function (e) {
            if (!ds.equals(e[0], e[1])) {
              console.log('    ✘ ' + e[0] + ' was expected to be ' + e[1]);
            }
          });
        });
      }),
      trap: $trap$(function (fn, originalScope) {
        if (typeof fn !== 'function') {
          throw new Error('@trap must be followed by a logic block');
        }

        return $trap$(function (value/*, scope*/) {
          if (fn.$logic$) {
            var newScope = ds.scope(originalScope);
            newScope[IT] = value;
            return fn(newScope);
          }

          else {
            return fn(value);
          }
        });
      }),
      with: function (fn) {
        return $trap$(function (args) {
          if (!Array.isArray(args)) {
            args = [args];
          }
          return fn.apply(null, args);
        });
      }
    },

    apply: function (logic, createdScope) {
      return $logic$(function applyScope(scope, originalScope, priority) {
        var secondaryScope;

        if (priority || !createdScope) {
          secondaryScope = originalScope;
        }

        else {
          secondaryScope = createdScope;
        }

        if (!scope || !scope.$state$) {
          var it = scope;
          scope = ds.scope(createdScope);
          secondaryScope = undefined;
          scope[IT] = it;
        }

        if (originalScope && !originalScope.$state$) {
          originalScope = undefined;
        }

        logic.items.forEach(function (step) {
          ds.execute(step, scope, secondaryScope);
        });

        if (scope.$state$.return) {
          return scope.$state$.lastValue;
        }

        return scope;
      });
    },

    applyValue: function (scope, originalScope, value, step) {
      if (scope.$state$.value === EMPTY) {
        scope.$state$.value = value;
      }

      else {
        var left = scope.$state$.value;
        scope.$state$.value = ds.combine(left, value, scope, originalScope, step);
      }
    },

    combine: function (first, second, scope, originalScope, step) {
      if (first === EMPTY) {
        return second;
      }

      else if (typeof first === 'function') {
        if (first.$trap$) {
          if (typeof second === 'function' && second.$bust$) {
            return second(first, scope);
          }
          return first(second, scope);
        }

        if (first.$logic$) {
          if (typeof second === 'function' && second.$logic$) {
            var newScope = ds.scope(scope);

            if (typeof first !== 'undefined' && first !== EMPTY) {
              newScope[IT] = first;
            }

            return second(newScope, originalScope);
          }

          else if (typeof second === 'function') {
            return second(first);
          }

          else if (second && second.$state$) {
            return first(second, scope);
          }

          else if (Array.isArray(second)) {
            var newScope = ds.scope(scope);
            return second.map(function (item) {

              if (typeof item !== 'undefined' && item !== EMPTY) {
                newScope[IT] = item;
              }

              return first(newScope, originalScope);
            });
          }
        }

        else if (typeof second === 'function' && second.$logic$) {
          var newScope = ds.scope(scope);

          if (typeof first !== 'undefined' && first !== EMPTY) {
            newScope[IT] = first;
          }

          return second(newScope, originalScope);
        }

        else if (typeof second === 'function') {
          return second(first);
        }
      }

      else if (typeof second === 'function') {
        if (second.$logic$) {
          var newScope = ds.scope(scope);

          if (typeof first !== 'undefined' && first !== EMPTY) {
            newScope[IT] = first;
          }

          if (first && typeof first === 'object' && first.$populate$) {
            Object.keys(first).forEach(function (key) {
              newScope[key] = first[key];
            });
          }

          return second(newScope, originalScope);
        }

        else {
          return second(first);
        }
      }

      else if (typeof first === 'string') {
        if (second === null) {
          second = 'nil';
        }

        if (typeof second === 'undefined') {
          second = 'undef';
        }

        if (typeof second === 'object') {
          return second[first];
        }

        return first + String(second);
      }

      else if (typeof first === 'number') {
        return second[first];
      }

      throw ds.errorMessage(new SyntaxError('Invalid combination of ' +
                            ds.type(first) + ' and ' + ds.type(second)), step);
    },

    empty: ,

    execute: function (step, scope, originalScope) {
      if (step.type === BREAK) {
        scope.$state$.conditionFailure = false;
        if (scope.$state$.break) {
          return;
        }
        scope.$state$.break = true;
      }

      else {
        scope.$state$.break = false;
      }

      if (scope.$state$.conditionFailure) {
        return;
      }

      var resolve = scope.$state$.resolve;
      var needsResolve = resolve.length > 0;

      var nameExpected = resolve.length === 0 || (
        resolve[resolve.length - 1].type === OPERATOR &&
        resolve[resolve.length - 1].value === '.'
      );

      if (step.type === NAME && nameExpected) {
        resolve.push(step);
        return;
      }

      if (step.type === OPERATOR && step.value === '.') {
        if (resolve.length === 0) {
          scope.$state$.value = $trap$(function (key, scope) {
            return getNamedValue(key, scope, scope, originalScope, step);
          });
        }

        else if (nameExpected) {
          throw ds.errorMessage(new SyntaxError('Invalid'), step);
        }

        else {
          resolve.push(step);
        }
        return;
      }

      var collapse = function () {
        if (resolve.length === 0) {
          return;
        }

        var value = ds.resolve(scope, originalScope);

        if (scope.$state$.operator.length > 0) {
          scope.$state$.value = ds.operate(scope, originalScope, value, step);
        }

        else {
          ds.applyValue(scope, originalScope, value, step);
        }
      };

      if (step.type === OPERATOR && step.value === '?') {
        if (scope.$state$.resolve.length === 0) {
          scope.$state$.resolve.push({
            type: NAME,
            value: 'true'
          });
        }
        collapse();
        if (scope[IT] !== scope.$state$.value) {
          scope.$state$.conditionFailure = true;
        }
        scope.$state$.return = true;
        scope.$state$.value = EMPTY;
        return;
      }

      if (step.type === OPERATOR && step.value === ':') {
        if (nameExpected) {
          if (resolve.length) {
            throw ds.errorMessage(new SyntaxError('Unexpected assigment operator'), step);
          }
          scope.$state$.convenienceKey = true;
          return;
        }

        if (scope.$state$.key !== EMPTY) {
          throw ds.errorMessage(new SyntaxError('Unexpected assigment operator'), step);
        }

        if (resolve.length === 1 && resolve[0].type === NAME) {
          scope.$state$.key = resolve.map(
            function (x) {return x.value;}
          ).join('');
        }

        else {
          collapse();
          scope.$state$.key = scope.$state$.value;
        }

        scope.$state$.resolve = [];
        scope.$state$.value = EMPTY;
        return;
      }

      if (step.type === OPERATOR) {
        if (resolve.length > 0 && nameExpected) {
          throw ds.errorMessage(new SyntaxError('Unexpected operator'), step);
        }
        collapse();
        scope.$state$.operator.push(step);
        return;
      }

      collapse();

      resolve = scope.$state$.resolve;

      if (step.type === BREAK) {
        if (scope.$state$.operator.length > 0) {
          scope.$state$.value = ds.operate(scope, originalScope, undefined, step);
        }

        if (scope.$state$.key !== EMPTY) {
          if (scope.$state$.value !== EMPTY) {
            scope[scope.$state$.key] = scope.$state$.value;
          }

          scope.$state$.key = EMPTY;
          scope.$state$.value = EMPTY;
          scope.$state$.return = false;
        }

        else if ('accumulate' in scope.$state$) {
          if (scope.$state$.value !== EMPTY) {
            scope.$state$.accumulate.push(scope.$state$.value);
          }
          scope.$state$.value = EMPTY;
          scope.$state$.return = false;
        }

        else if (scope.$state$.value !== EMPTY) {
          scope.$state$.return = true;
          scope.$state$.lastValue = scope.$state$.value;
        }

        scope.$state$.value = EMPTY;
        return;
      }

      resolve.push(step);
    },

    exists: $logic$(function (scope, originalScope) {
      var name = scope[IT];
      var parentScope = Object.getPrototypeOf(scope);
      if (parentScope && typeof parentScope[name] !== 'undefined') {
        return true;
      }
      if (!originalScope) {
        return false;
      }
      return typeof originalScope[name] !== 'undefined';
    }),

    extension: '.ds',

    group: {},

    import: function (name) {

    },

    index: 'index',

    logic: ,

    merge: function (scope, originalScope, value, step) {
      if (typeof value === 'function' && value.$logic$) {
        return value(scope, originalScope);
      }

      else if (Array.isArray(value)) {
        if (!Array.isArray(scope.$state$.accumulate)) {
          throw ds.errorMessage(
            new TypeError('Cannot merge array and non-array'), step
          );
        }
        value.forEach(function (item) {
          scope.$state$.accumulate.push(item);
        });
      }

      else if (typeof value === 'object') {
        Object.keys(value).forEach(function (key) {
          scope[key] = value[key];
        });
      }

      else {
        // do nothing
      }
    },

    operate: function (scope, originalScope, right, step) {
      var left = scope.$state$.value;
      var operator = scope.$state$.operator;
      scope.$state$.operator = [];

      var combinedOperator = {
        position: operator[0].position,
        value: operator.map(function (o) {
          return o.value;
        }).join('')
      };

      if (combinedOperator.value[combinedOperator.value.length - 1] === '-') {
        if (combinedOperator.value.length > 1 || typeof left !== 'number') {
          combinedOperator.value = combinedOperator.value.substr(0,
                                   combinedOperator.value.length - 1);
          if (typeof right !== 'number') {
            throw ds.errorMessage(new TypeError('Cannot negate a non-numeric value'), step);
          }

          right = -1 * right;

          if (combinedOperator.value.length === 0) {
            return ds.combine(left, right, scope, originalScope, step);
          }
        }
      }

      if (combinedOperator.value === '!') {
        return (
          typeof left === 'undefined' ||
                 left === false ||
                 left === null
        );
      }

      else if (combinedOperator.value === '&') {
        if ((!left || left === EMPTY) && (!right || right === EMPTY)) {
          var value = scope[IT];
          if (typeof value === 'undefined') {
            throw ds.errorMessage(
              new TypeError('Injectable "@it" not found for &'), step
            );
          }
          ds.merge(scope, originalScope, value, step);
          return EMPTY;
        }

        if (left && left !== EMPTY) {
          value = ds.merge(scope, originalScope, left, step);
        }

        if (right && right !== EMPTY) {
          value = ds.merge(scope, originalScope, right, step);
        }

        return EMPTY;
      }

      else if (combinedOperator.value === '!=') {
        return left !== right;
      }

      else if (combinedOperator.value === '=') {
        return left === right;
      }

      else if (combinedOperator.value === '>') {
        return left > right;
      }

      else if (combinedOperator.value === '<') {
        return left < right;
      }

      else if (combinedOperator.value === '>=') {
        return left >= right;
      }

      else if (combinedOperator.value === '<=') {
        return left <= right;
      }

      else if (combinedOperator.value === '||') {
        return left || right;
      }

      else if (combinedOperator.value === '&&') {
        return left && right;
      }

      else if (combinedOperator.value === '+') {
        if (typeof left === 'function') {
          if (typeof right === 'function') {
            return $logic$(function (scope, originalScope) {
              left(scope, originalScope);
              right(scope, originalScope);
              return scope;
            });
          }

          else {
            throw ds.errorMessage(
              new Error('Cannot add function and ' + ds.type(right)), step
            );
          }
        }

        else if (typeof right === 'function') {
          throw ds.errorMessage(
            new Error('Cannot add ' + ds.type(left) + ' and function'), step
          );
        }

        return left + right;
      }

      else if (combinedOperator.value === '-') {
        return left - right;
      }

      else if (combinedOperator.value === '*') {
        return left * right;
      }

      else if (combinedOperator.value === '/') {
        return left / right;
      }

      else if (combinedOperator.value === '%') {
        return left % right;
      }

      else {
        throw ds.errorMessage(new SyntaxError('Operator not implemented:'),
                              combinedOperator);
      }
    },

    parse: function (source, name) {
      var isEscape = false;
      var isComment = false;
      var breaks = [-1];
      var position = function (i) {
        var positionFn = function () {
          var line = -1;
          while (i > breaks[line + 1]) {
            line++;
          }
          var column = i - breaks[line];
          return 'line ' + ++line + ' column ' + column;
        };

        positionFn.getSource = function (includeCaret) {
          var line = -1;
          while (i > breaks[line + 1]) {
            line++;
          }
          var column = i - breaks[line];
          var start = breaks[line] + 1;
          var sourceLine = source.substr(start,
                                         (breaks[line + 1] || start + 1) - start);

          if (includeCaret) {
            sourceLine = '\n' + name + ':' + (line + 1) + '\n' + sourceLine + '\n' +
                         new Array(column).join(' ') + '^';
          }
          return sourceLine;
        };

        return positionFn;
      };

      var logic = ds.logic('Logic', [0, source.length - 1]);
      logic.position = position(0);
      var head = logic;
      var stack = [];
      var previous;
      var isString;
      var queue = {
        type: NAME,
        range: [0],
        position: position(0),
        value: ''
      };

      var queueToHead = function (i) {
        if (queue.value.length) {
          queue.range.push(i - 1);
          head.items.push(queue);
        }
        queue = {
          type: NAME,
          range: [i + 1],
          position: position(i + 1),
          value: ''
        };
      };

      for (var i = 0; i < source.length; i++) {
        if (source[i] === '\n') {
          isComment = false;
          breaks.push(i);
        }

        isString = head.type &&
                   ds.syntax.blocks[head.type] &&
                   ds.syntax.blocks[head.type].string;

        if (isComment) {
          // do nothing
        }

        else if (!isString && !isComment && source[i] === ds.syntax.comment) {
          isComment = true;
          continue;
        }

        else if (!isEscape && source[i] === ds.syntax.escape) {
          isEscape = true;
        }

        else if (isEscape) {
          isEscape = false;

          if (isString) {
            var add = source[i];

            if (add === 'n') {
              add = '\n';
            }

            else if (add === 't') {
              add = '\t';
            }

            queue.value += add;
          }
        }

        else if (!isString && source[i] in ds.syntax.open) {
          queueToHead(i);
          previous = head;
          stack.push(previous);
          head = ds.logic(ds.syntax.open[source[i]], [i]); // I love open source
          head.position = position(i);
          previous.items.push(head);
        }

        else if (isString && source[i] === ds.syntax.blocks[head.type].close) {
          queueToHead(i);
          head.range.push(i);
          head = stack.pop();
        }

        else if (isString) {
          queue.value += source[i];
        }

        else if (ds.syntax.close.indexOf(source[i]) !== -1) {
          if (head.type && ds.syntax.blocks[head.type] &&
              source[i] === ds.syntax.blocks[head.type].close) {
            queueToHead(i);
            head.items.push({type: BREAK, position: position(i)});
            head.range.push(i);
            head = stack.pop();
          }

          else {
            head = null;
          }

          if (!head) {
            throw ds.errorMessage(new SyntaxError('Unexpected'), {
              value: '"' + source[i] + '"',
              position: position(i)
            });
          }
        }

        else if (ds.syntax.separators.indexOf(source[i]) !== -1) {
          queueToHead(i);
          head.items.push({type: BREAK, position: position(i)});
        }

        else if (ds.syntax.whitespace.indexOf(source[i]) !== -1) {
          queueToHead(i);
        }

        else if (/[^$@_a-zA-Z0-9]/.test(source[i])) {
          queueToHead(i);
          head.items.push({type: OPERATOR, value: source[i], position: position(i)});
        }

        else {
          queue.value += source[i];
        }
      }

      return ds.apply(logic);
    },

    resolve: function (scope, originalScope) {
      var value = scope;
      var allowRead = true;
      var resolve = scope.$state$.resolve;
      scope.$state$.resolve = [];

      if (resolve.length === 0) {
        return undefined;
      }

      var lastStep;
      resolve.forEach(function (step) {
        lastStep = step;

        if (step.type === OPERATOR && step.value === '.') {
          if (allowRead) {
            throw ds.errorMessage(new SyntaxError('Invalid'), step);
          }
          allowRead = true;
          return;
        }

        if (!allowRead) {
          throw ds.errorMessage(new SyntaxError('Invalid'), step);
        }

        allowRead = false;

        if (step.type === STRING) {
          value = step.items.map(function (i) {
            return i.value;
          }).join('');
        }

        else if (step.type === GROUP) {
          var groupScope = ds.scope(scope);
          ds.apply(step)(groupScope, originalScope);
          value = groupScope.$state$.lastValue;
        }

        else if (step.type === ARRAY) {
          var arrayScope = ds.scope(scope);
          arrayScope.$state$.break = true;
          arrayScope.$state$.accumulate = [];
          ds.apply(step)(arrayScope, originalScope);
          value = arrayScope.$state$.accumulate;
        }

        else if (step.type === LOGIC) {
          value = ds.apply(step, scope);
        }

        else if (step.type === NAME) {
          if (scope.$state$.convenienceKey) {
            value = step.value;
          }

          else {
            value = getNamedValue(step.value, value, scope, originalScope, step);
          }
        }

        else {
          throw ds.errorMessage(new SyntaxError('Invalid'), step);
        }
      });

      if (scope.$state$.convenienceKey) {
        scope.$state$.convenienceKey = false;
        scope.$state$.key = value;
        value = getNamedValue(scope.$state$.key, scope, scope, originalScope, lastStep);
      }

      return value;
    },

    scope: function (parentScope) {
      var scope = Object.create(parentScope || Object.prototype);
      Object.defineProperty(scope, '$state$', {
        value: {
          key: EMPTY,
          value: EMPTY,
          return: false,
          operator: [],
          resolve: []
        },
        enumerable: false
      });
      return scope;
    },

    syntax: ,


  [
    'exists',
    'type'
  ].forEach(function (key) {
    $bust$(ds[key]);
    ds.global[key] = ds[key];
  });

  ds.global.import = ds.import;