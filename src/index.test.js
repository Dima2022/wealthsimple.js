const Wealthsimple = require('./index');

describe('Wealthsimple', () => {
  const accessToken = 'fake12345';
  const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  let wealthsimple;
  beforeEach(() => {
    wealthsimple = new Wealthsimple({ clientId: 'clientid', env: 'sandbox', apiVersion: 'v1' });
  });

  describe('isAuthExpired()', () => {
    describe('auth is present and not expired', () => {
      it('returns false', () => {
        const date = new Date();
        date.setSeconds(1000000);
        wealthsimple.auth = { expires_at: date };
        expect(wealthsimple.isAuthExpired()).toBe(false);
      });
    });

    describe('auth is present but expired', () => {
      it('returns true', () => {
        wealthsimple.auth = { expires_at: Date.parse('2018-02-01T04:20:12Z') };
        expect(wealthsimple.isAuthExpired()).toBe(true);
      });
    });

    describe('auth is not present', () => {
      it('returns false', () => {
        expect(wealthsimple.isAuthExpired()).toBe(false);
      });
    });
  });

  describe('isAuthRefreshable()', () => {
    describe('auth is present and refreshable', () => {
      it('returns true', () => {
        wealthsimple.auth = { refresh_token: 'refresh' };
        expect(wealthsimple.isAuthRefreshable()).toBe(true);
      });
    });

    describe('auth is present but not refreshable', () => {
      it('returns false', () => {
        wealthsimple.auth = { refresh_token: null };
        expect(wealthsimple.isAuthRefreshable()).toBe(false);
      });
    });

    describe('auth is not present', () => {
      it('returns false', () => {
        expect(wealthsimple.isAuthRefreshable()).toBe(false);
      });
    });
  });

  describe('authExpiresAt()', () => {
    describe('auth is present', () => {
      it('returns date', () => {
        wealthsimple.auth = { expires_at: Date.parse('2018-02-01T04:20:12Z') };
        expect(wealthsimple.authExpiresAt()).toEqual(expect.any(Date));
      });
    });

    describe('auth is not present', () => {
      it('returns falsy', () => {
        expect(wealthsimple.authExpiresAt()).toBeFalsy();
      });
    });
  });

  describe('currentProfile()', () => {
    describe('profile is present', () => {
      it('returns profile', () => {
        wealthsimple.profile = 'trade';
        expect(wealthsimple.currentProfile()).toEqual('trade');
      });
    });

    describe('profile is not present', () => {
      beforeEach(() => {
        wealthsimple.auth = {
          profiles: {
            trade: {
              default: 'user-efg456',
            },
            tax: {
              default: 'user-hij789',
            },
          },
        };
      });
      it('returns first profile', () => {
        expect(wealthsimple.currentProfile()).toEqual('trade');
      });
    });
  });

  describe('resourceOwnerId and clientCanonicalId', () => {
    describe('auth is not present', () => {
      beforeEach(() => {
        wealthsimple.auth = null;
      });

      it('returns falsy', () => {
        expect(wealthsimple.resourceOwnerId()).toBeFalsy();
        expect(wealthsimple.clientCanonicalId()).toBeFalsy();
      });
    });

    describe('auth is present', () => {
      beforeEach(() => {
        wealthsimple.auth = {
          access_token: accessToken,
          resource_owner_id: 'user-abc123',
          client_canonical_id: 'person-def345',
        };
      });

      it('returns the IDs', () => {
        expect(wealthsimple.resourceOwnerId()).toEqual('user-abc123');
        expect(wealthsimple.clientCanonicalId()).toEqual('person-def345');
      });
    });

    describe('using identity token', () => {
      describe('client_canonical_id is present', () => {
        beforeEach(() => {
          wealthsimple.auth = {
            access_token: jwtToken,
            resource_owner_id: 'user-abc123',
            client_canonical_id: 'person-def345',
            profiles: {
              invest: {
                default: 'user-efg456',
              },
            },
          };
        });

        it('returns the IDs', () => {
          expect(wealthsimple.resourceOwnerId()).toEqual('user-efg456');
          expect(wealthsimple.clientCanonicalId()).toEqual('person-def345');
        });
      });

      describe('client_canonical_id is not present', () => {
        beforeEach(() => {
          wealthsimple.auth = {
            access_token: jwtToken,
            resource_owner_id: 'user-abc123',
            client_canonical_id: null,
            client_canonical_ids: {
              invest: {
                default: 'person-def345',
              },
            },
            profiles: {
              invest: {
                default: 'user-efg456',
              },
            },
          };
        });

        it('returns the IDs', () => {
          expect(wealthsimple.resourceOwnerId()).toEqual('user-efg456');
          expect(wealthsimple.clientCanonicalId()).toEqual('person-def345');
        });
      });
    });
  });

  describe('shouldUseIdentityToken()', () => {
    describe('useIdentityToken is set', () => {
      describe('auth is present and is a jwt', () => {
        it('returns true when useIdentityToken set to true', () => {
          wealthsimple.auth = { access_token: jwtToken };
          wealthsimple.useIdentityToken = true;
          expect(wealthsimple.shouldUseIdentityToken()).toBe(true);
        });

        it('returns true when token is a jwt and flag set to false', () => {
          wealthsimple.auth = { access_token: jwtToken };
          wealthsimple.useIdentityToken = false;
          expect(wealthsimple.shouldUseIdentityToken()).toBe(true);
        });
      });

      describe('auth is present and is a bearer token', () => {
        it('returns false even when set to true', () => {
          wealthsimple.auth = { access_token: accessToken };
          wealthsimple.useIdentityToken = true;
          expect(wealthsimple.shouldUseIdentityToken()).toBeFalsy();
        });

        it('returns false when set to false', () => {
          wealthsimple.auth = { access_token: accessToken };
          wealthsimple.useIdentityToken = false;
          expect(wealthsimple.shouldUseIdentityToken()).toBeFalsy();
        });
      });

      describe('auth is not present', () => {
        it('returns true when set to true', () => {
          wealthsimple.useIdentityToken = true;
          expect(wealthsimple.shouldUseIdentityToken()).toBe(true);
        });

        it('returns false when set to false and nothing else is set', () => {
          wealthsimple.useIdentityToken = false;
          expect(wealthsimple.shouldUseIdentityToken()).toBeFalsy();
        });
      });
    });

    describe('useIdentityToken is not set, and auth is set', () => {
      it('returns true when access token is a jwt', () => {
        wealthsimple.auth = { access_token: jwtToken };
        expect(wealthsimple.shouldUseIdentityToken()).toBe(true);
      });

      it('returns false when access token is a bearer token', () => {
        wealthsimple.auth = { access_token: accessToken };
        expect(wealthsimple.shouldUseIdentityToken()).toBeFalsy();
      });
    });

    describe('token is present', () => {
      it('returns true when token passed in is a jwt', () => {
        expect(wealthsimple.shouldUseIdentityToken(jwtToken)).toBe(true);
      });

      it('returns false when token passed in is a bearer token', () => {
        expect(wealthsimple.shouldUseIdentityToken(accessToken)).toBeFalsy();
      });
    });
  });
});
