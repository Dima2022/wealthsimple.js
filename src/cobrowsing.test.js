const CoBrowsing = require('./cobrowsing');

describe('CoBrowsing', () => {
  let subject = null;

  const context =
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhaWQiOiJ1c2VyLWZhMXB6Z3hhMnpvIiwidGlkIjoidXNlci04dy1nbHIyeHh1dyJ9.F8jeRkTnWyOYadoNbh3Tt100OLQlEBmtklK0vEGmrAuZkVjUTUMNzbNXk8MpHd9ahVMMRdvL9KxnX--9gdC3Pw';
  const publicKey = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEefUNZ8T+aVKookOPdmkkeQRdJFW8
6th4+Fe2NeJFbb1F5Gwi9JW64K8g/zWPE77ttwuB1VZrSFqj7tPBFJErDA==
-----END PUBLIC KEY-----`;

  describe('with valid co-browsing context and public key', () => {
    const warn = jest.fn();
    const error = jest.fn();

    beforeEach(() => {
      const logger = { warn, error };

      subject = new CoBrowsing({ context, publicKey, logger });
    });

    describe('on init', () => {
      it('can initialize', () => {
        expect(subject).not.toBeNull();
      });

      it('has users', () => {
        expect(subject.users).not.toBeNull();
      });

      it('does not log', () => {
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
      });
    });

    describe('isCoBrowsing', () => {
      it('returns true', () => {
        expect(subject.isCoBrowsing()).toBe(true);
      });
    });

    describe('getTargetUser', () => {
      it('can return the target user', () => {
        expect(subject.getTargetUser()).toEqual('user-8w-glr2xxuw');
      });
    });

    describe('getActorUser', () => {
      it('can return the actor user', () => {
        expect(subject.getActorUser()).toEqual('user-fa1pzgxa2zo');
      });
    });
  });

  describe('with no context', () => {
    const warn = jest.fn();
    const error = jest.fn();

    beforeEach(() => {
      const logger = { warn, error };

      subject = new CoBrowsing({ publicKey, logger });
    });

    it('logs', () => {
      expect(warn).toHaveBeenCalledWith('`context` is required');
    });

    it('returns null users', () => {
      expect(subject.users).toBeNull();
    });

    describe('isCoBrowsing', () => {
      it('returns false', () => {
        expect(subject.isCoBrowsing()).toBe(false);
      });
    });

    describe('getTargetUser', () => {
      it('returns null', () => {
        expect(subject.getTargetUser()).toBeNull();
      });
    });

    describe('getActorUser', () => {
      it('returns null', () => {
        expect(subject.getActorUser()).toBeNull();
      });
    });
  });

  describe('with no public key', () => {
    const warn = jest.fn();
    const error = jest.fn();

    beforeEach(() => {
      const logger = { warn, error };

      subject = new CoBrowsing({ context, logger });
    });

    it('logs', () => {
      expect(warn).toHaveBeenCalledWith('`publicKey` is required');
    });

    it('returns null users', () => {
      expect(subject.users).toBeNull();
    });

    describe('isCoBrowsing', () => {
      it('returns false', () => {
        expect(subject.isCoBrowsing()).toBe(false);
      });
    });

    describe('getTargetUser', () => {
      it('returns null', () => {
        expect(subject.getTargetUser()).toBeNull();
      });
    });

    describe('getActorUser', () => {
      it('returns null', () => {
        expect(subject.getActorUser()).toBeNull();
      });
    });
  });

  describe('with no options', () => {
    beforeEach(() => {
      subject = new CoBrowsing();
    });

    it('initializes with null values', () => {
      expect(subject.users).toBeUndefined();
    });

    describe('isCoBrowsing', () => {
      it('returns false', () => {
        expect(subject.isCoBrowsing()).toBe(false);
      });
    });

    describe('getTargetUser', () => {
      it('returns null', () => {
        expect(subject.getTargetUser()).toBeNull();
      });
    });
  });
});
