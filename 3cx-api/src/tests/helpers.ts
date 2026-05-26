/**
 * Helpers partages par tous les fichiers de test.
 *
 * Fournit une app Express prete a l'emploi avec le Fake3CXModule injecte,
 * et une instance supertest pour envoyer des requetes HTTP.
 */
import supertest from "supertest";
import { createApp } from "../app";
import { Fake3CXModule } from "./mocks/fake-3cx-module";

export const API_KEY = "test-api-key-1234";

export function createTestContext() {
  const fake = new Fake3CXModule();
  const app = createApp(fake);
  const request = supertest(app);
  return { fake, app, request };
}

/**
 * Headers d'authentification valides pour les tests.
 */
export function authHeader() {
  return { "x-api-key": API_KEY };
}
