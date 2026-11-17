/**
 * Holds the one active instance of a service, such as the one the open main
 * window created, so code without a reference to the window can reach it.
 */
export class RegistryActiveSlot<Service> {
  private service: Service | null = null;

  /**
   * Returns the active service.
   *
   * @returns Service, or null when none is active.
   */
  read(): Service | null {
    return this.service;
  }

  /**
   * Makes a service the active one.
   *
   * @param service Service to store.
   */
  write(service: Service): void {
    this.service = service;
  }

  /**
   * Clears the slot when it holds the given service.
   *
   * @param service Service that is going away.
   */
  releaseIfStored(service: Service): void {
    if (this.service === service) {
      this.service = null;
    }
  }
}
